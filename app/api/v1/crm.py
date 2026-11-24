"""Legal CRM endpoints for web dashboard and lawyer intake pipeline."""

from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.appointment import Appointment
from app.db.models.inquiry import Inquiry
from app.db.models.user import User
from app.db.session import get_db_session

router = APIRouter(prefix="/crm", tags=["crm"])


class InquiryApprovalRequest(BaseModel):
    final_response: str
    lawyer_id: int | None = None


@router.get("/leads")
async def list_leads(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    lead_status: str | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """List captured leads and client profiles."""
    stmt = select(User).order_by(User.created_at.desc()).limit(limit)
    if lead_status:
        stmt = stmt.where(User.lead_status == lead_status)
    res = await session.execute(stmt)
    users = res.scalars().all()

    return [
        {
            "id": u.id,
            "telegram_id": u.telegram_id,
            "full_name": u.full_name,
            "phone_number": u.phone_number,
            "language": u.language,
            "lead_status": u.lead_status,
            "free_questions_left": u.free_questions_left,
            "is_subscribed": u.is_subscribed,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]


@router.get("/inquiries")
async def list_inquiries(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    risk_level: str | None = None,
    inquiry_status: str | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """List legal inquiries, risk evaluations, and express audits."""
    stmt = select(Inquiry).order_by(Inquiry.created_at.desc()).limit(limit)
    if risk_level:
        stmt = stmt.where(Inquiry.risk_level == risk_level)
    if inquiry_status:
        stmt = stmt.where(Inquiry.status == inquiry_status)
    res = await session.execute(stmt)
    inquiries = res.scalars().all()

    return [
        {
            "id": inq.id,
            "user_id": inq.user_id,
            "channel": inq.channel,
            "detected_category": inq.detected_category,
            "question_text": inq.question_text,
            "stt_transcript": inq.stt_transcript,
            "risk_level": inq.risk_level,
            "risk_score": inq.risk_score,
            "ai_draft_response": inq.ai_draft_response,
            "ai_upsell_offer": inq.ai_upsell_offer,
            "final_response": inq.final_response,
            "status": inq.status,
            "created_at": inq.created_at.isoformat() if inq.created_at else None,
        }
        for inq in inquiries
    ]


@router.get("/appointments")
async def list_appointments(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    status_filter: str | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """List scheduled consultation appointments."""
    stmt = select(Appointment).order_by(Appointment.scheduled_at.desc()).limit(limit)
    if status_filter:
        stmt = stmt.where(Appointment.status == status_filter)
    res = await session.execute(stmt)
    appointments = res.scalars().all()

    return [
        {
            "id": appt.id,
            "user_id": appt.user_id,
            "service_id": appt.service_id,
            "appointment_type": appt.appointment_type,
            "scheduled_at": appt.scheduled_at.isoformat() if appt.scheduled_at else None,
            "status": appt.status,
            "created_at": appt.created_at.isoformat() if appt.created_at else None,
        }
        for appt in appointments
    ]


@router.post("/inquiries/{inquiry_id}/approve")
async def approve_inquiry(
    inquiry_id: int,
    payload: InquiryApprovalRequest,
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, Any]:
    """Lawyer approves or edits an AI draft legal response."""
    final_response = payload.final_response.strip()
    if not final_response:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tasdiqlash uchun javob bo'sh bo'lmasligi kerak",
        )

    stmt = select(Inquiry).where(Inquiry.id == inquiry_id)
    res = await session.execute(stmt)
    inquiry = res.scalar_one_or_none()
    if not inquiry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inquiry not found")

    inquiry.final_response = final_response
    inquiry.status = "approved"
    inquiry.lawyer_id = payload.lawyer_id
    inquiry.answered_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(inquiry)

    return {
        "ok": True,
        "inquiry_id": inquiry.id,
        "status": inquiry.status,
    }


class LeadStatusUpdate(BaseModel):
    lead_status: str  # new, express_audit, proposal_sent, appointment_booked, closed_won
    full_name: str | None = None
    phone_number: str | None = None


class LeadProfileUpdate(BaseModel):
    full_name: str | None = None
    phone_number: str | None = None
    lead_status: str | None = None


@router.get("/leads/{user_id}")
async def get_lead_detail(
    user_id: int,
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, Any]:
    """Get detailed lead/user info with inquiry and referral stats."""
    stmt = select(User).where(User.id == user_id)
    res = await session.execute(stmt)
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Count inquiries
    inq_stmt = select(func.count(Inquiry.id)).where(Inquiry.user_id == user_id)
    inq_res = await session.execute(inq_stmt)
    inquiry_count = inq_res.scalar() or 0

    # Count referrals
    ref_stmt = select(func.count(User.id)).where(User.referred_by_id == user_id)
    ref_res = await session.execute(ref_stmt)
    referral_count = ref_res.scalar() or 0

    return {
        "id": user.id,
        "telegram_id": user.telegram_id,
        "full_name": user.full_name,
        "phone_number": user.phone_number,
        "language": user.language,
        "lead_status": user.lead_status,
        "free_questions_left": user.free_questions_left,
        "is_subscribed": user.is_subscribed,
        "referral_code": user.referral_code,
        "referred_by_id": user.referred_by_id,
        "inquiry_count": inquiry_count,
        "referral_count": referral_count,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


@router.put("/leads/{user_id}/status")
async def update_lead_status(
    user_id: int,
    payload: LeadStatusUpdate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, Any]:
    """Update a lead's pipeline stage."""
    stmt = select(User).where(User.id == user_id)
    res = await session.execute(stmt)
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.lead_status = payload.lead_status
    if payload.full_name is not None:
        user.full_name = payload.full_name.strip() or None
    if payload.phone_number is not None:
        user.phone_number = payload.phone_number.strip() or None
    await session.commit()
    await session.refresh(user)
    return {
        "ok": True,
        "id": user.id,
        "full_name": user.full_name,
        "phone_number": user.phone_number,
        "lead_status": user.lead_status,
    }


@router.put("/leads/{user_id}/profile")
async def update_lead_profile(
    user_id: int,
    payload: LeadProfileUpdate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, Any]:
    """Update editable customer profile fields from CRM inbox."""
    stmt = select(User).where(User.id == user_id)
    res = await session.execute(stmt)
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if payload.full_name is not None:
        user.full_name = payload.full_name.strip() or None
    if payload.phone_number is not None:
        user.phone_number = payload.phone_number.strip() or None
    if payload.lead_status is not None:
        user.lead_status = payload.lead_status

    await session.commit()
    await session.refresh(user)
    return {
        "ok": True,
        "id": user.id,
        "full_name": user.full_name,
        "phone_number": user.phone_number,
        "lead_status": user.lead_status,
    }
