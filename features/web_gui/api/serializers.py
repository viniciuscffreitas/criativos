from pydantic import BaseModel


class ProjectOut(BaseModel):
    slug: str
    name: str
    description: str
    ad_count: int
    variant_count: int
    created_at: str


class ProjectListOut(BaseModel):
    projects: list[ProjectOut]


class ErrorOut(BaseModel):
    error: str
    code: str
    raw: str | None = None
