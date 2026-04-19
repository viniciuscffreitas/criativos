from fastapi import APIRouter, HTTPException

from features.web_gui.api.serializers import ErrorOut, ProjectListOut, ProjectOut
from features.web_gui.services.project_store import ProjectStore
from features.web_gui.settings import projects_yaml_path

router = APIRouter(prefix="/projects", tags=["projects"])


def _store() -> ProjectStore:
    return ProjectStore(projects_yaml_path())


@router.get("", response_model=ProjectListOut)
def list_projects():
    items = _store().list()
    return ProjectListOut(projects=[ProjectOut(**p.__dict__) for p in items])


@router.get("/{slug}", response_model=ProjectOut, responses={404: {"model": ErrorOut}})
def get_project(slug: str):
    try:
        p = _store().get(slug)
    except KeyError:
        raise HTTPException(status_code=404, detail={
            "error": f"Project {slug!r} not found in projects.yaml",
            "code": "PROJECT_NOT_FOUND",
        })
    return ProjectOut(**p.__dict__)
