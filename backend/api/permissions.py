from rest_framework import permissions


class IsPatient(permissions.BasePermission):
    """Allow access only to users with the 'patient' role."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == "patient"
        )


class IsProfessional(permissions.BasePermission):
    """Allow access only to users with the 'professional' role."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == "professional"
        )


class IsSupporter(permissions.BasePermission):
    """Allow access only to users with the 'supporter' role."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == "supporter"
        )


class IsPatientOrProfessional(permissions.BasePermission):
    """Allow access to patients or professionals."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ("patient", "professional")
        )


class IsProfessionalOrSupporter(permissions.BasePermission):
    """Allow access to professionals or supporters."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ("professional", "supporter")
        )


class IsAdmin(permissions.BasePermission):
    """Allow access only to users with the 'admin' role."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == "admin"
        )


class IsAdminOrProfessional(permissions.BasePermission):
    """Allow access to admin or professional users."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ("admin", "professional")
        )
