"""All SQLAlchemy models — imported here so create_tables() discovers them."""

from src.models.user import UserAccount
from src.models.team import Team, TeamMembership
from src.models.question import Question, TestCase
from src.models.assessment import Assessment, AssessmentQuestion, CandidateSession
from src.models.submission import CodeSubmission

__all__ = [
    "UserAccount",
    "Team",
    "TeamMembership",
    "Question",
    "TestCase",
    "Assessment",
    "AssessmentQuestion",
    "CandidateSession",
    "CodeSubmission",
]
