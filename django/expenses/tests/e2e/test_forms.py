import json
from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from uuid import uuid4

import pytest
from faker import Faker

from backendssc.access.form_permission import FormPermission
from backendssc.access.user_role import UserRole
from backendssc.api_v2.restplusplus.uuid_tools import (
    get_entity_uuid,
    to_uuidv4,
)
from backendssc.database.enums.form_filling_request_status import (
    FormFillingRequestStatus,
)
from backendssc.modules.companies.definitions import LDFeatureFlags
from backendssc.modules.evidences.models import EvidenceFileVirusScanStatus
from backendssc.modules.form_fillings.definitions import SmartAnswerApiResponse
from backendssc.modules.form_fillings.filling.question_block_fetchers import (
    QuestionBlockMetadataStats,
)
from backendssc.modules.form_fillings.filling.question_history_record import (
    QuestionHistoryRecordType,
)
from backendssc.modules.form_fillings.form_filling_service import (
    SmartAnswersStatus,
)
from backendssc.modules.form_fillings.metadata_service import MetadataService
from backendssc.modules.form_fillings.models import (
    FormFillingType,
    QuestionFillingHistoryType,
    ResponseFilling,
    ResponseFillingHistoryAction,
)
from backendssc.modules.response_types.models import ResponseType
from backendssc.sscutils.timeutils import datetime_to_iso8601
from backendssc.tests.unit import helpers

faker = Faker()


def test_post_form_attachment_permission_error(
    api_client,
    user_factory,
    form_filling_factory,
    standard_factory,
    company_factory,
    file_factory,
    check,
):
    """
    tests upload attachment to specific form record without right
    attachment's editable permission:
    endpoint: /forms/{id}/attachments
    - we should get a Forbidden http error with 403 as status code.
    """
    # create user and view context used to perform the request
    user = user_factory()
    user.add_role(UserRole.NORMAL)

    vendor_company = company_factory()
    standard = standard_factory()
    form = form_filling_factory(standard=standard, owner=vendor_company)

    api_response = helpers.post(
        api_client=api_client,
        path=f"/v2/forms/{form.id}/attachments",
        data={"file": open(file_factory(name=faker.name()).filepath, "rb")},
        content_type="multipart/form-data",
        user=user,
    )

    # perform the checks
    check.equal(api_response.status_code, HTTPStatus.FORBIDDEN)


def test_post_form_question_attachment_permission_error(
    api_client,
    user_factory,
    form_filling_factory,
    question_filling_factory,
    standard_factory,
    company_factory,
    file_factory,
    check,
):
    """
    tests upload attachment to specific form and specific question
    endpoint: /forms/{id}/questions/{id}/attachments
    without right attachment's editable permission:
    - we should get a Forbidden http error with 403 as status code.
    """
    # create user and view context used to perform the request
    user = user_factory()
    user.add_role(UserRole.NORMAL)

    vendor_company = company_factory()
    standard = standard_factory()
    form = form_filling_factory(standard=standard, owner=vendor_company)
    question = question_filling_factory(owner=vendor_company, form=form)

    api_response = helpers.post(
        api_client=api_client,
        path=f"/v2/forms/{form.id}/questions/{question.id}/attachments",
        data={"file": open(file_factory(name=faker.name()).filepath, "rb")},
        content_type="multipart/form-data",
        user=user,
    )

    # perform the checks
    check.equal(api_response.status_code, HTTPStatus.FORBIDDEN)


def test_post_form_response_attachment_permission_error(
    api_client,
    user_factory,
    form_filling_factory,
    response_filling_factory,
    standard_factory,
    company_factory,
    file_factory,
    check,
):
    """
    tests upload attachment to specific form and specific response
    endpoint: /forms/{id}/responses/{id}/attachments
    without right attachment's editable permission:
    - we should get a Forbidden http error with 403 as status code.
    """
    # create user and view context used to perform the request
    user = user_factory()
    user.add_role(UserRole.NORMAL)

    vendor_company = company_factory()
    standard = standard_factory()
    form = form_filling_factory(standard=standard, owner=vendor_company)
    response = response_filling_factory(owner=vendor_company, form=form)

    api_response = helpers.post(
        api_client=api_client,
        path=f"/v2/forms/{form.id}/responses/{response.id}/attachments",
        data={"file": open(file_factory(name=faker.name()).filepath, "rb")},
        content_type="multipart/form-data",
        user=user,
    )

    # perform the checks
    check.equal(api_response.status_code, HTTPStatus.FORBIDDEN)


@pytest.mark.parametrize(
    "rbac_roles, http_status_code",
    (
        (
            [UserRole.NORMAL, UserRole.RBAC_USER],
            HTTPStatus.OK,
        ),
        (
            [UserRole.RBAC_USER, UserRole.DOWNLOAD_SENT_QUESTIONNAIRES],
            HTTPStatus.OK,
        ),
        (
            [UserRole.RBAC_USER, UserRole.DOWNLOAD_RECEIVED_QUESTIONNAIRES],
            HTTPStatus.OK,
        ),
        ([UserRole.VIEW_STANDARDS], HTTPStatus.FORBIDDEN),
        ([UserRole.NORMAL], HTTPStatus.OK),
        ([UserRole.GUEST], HTTPStatus.OK),
    ),
)
def test_post_forms_downloads_attachments(
    rbac_roles,
    http_status_code,
    api_client,
    user_factory,
    form_filling_factory,
    mocker,
    check,
):
    """
    tests multiple forms download attachments
    endpoint: POST /forms/downloads/attachments
    """
    # create user and view context used to perform the request
    user = user_factory(roles=rbac_roles)
    forms = form_filling_factory.create_batch(10, owner=user.company)
    forms_uuids = [get_entity_uuid(form) for form in forms]

    mock_generate_forms_download_attachments_task = mocker.patch(
        "backendssc.modules.form_fillings.form_filling_service.FormFillingService.generate_forms_download_attachments_task",
        return_value=None,
    )

    api_response = helpers.post(
        api_client=api_client,
        path=f"/v2/forms/downloads/attachments",
        data=json.dumps({"form_ids": forms_uuids}),
        user=user,
        **{"feature_flags": {LDFeatureFlags.RBAC_QUESTIONNAIRES.value: True}},
    )

    # perform the checks
    check.equal(api_response.status_code, http_status_code)

    if http_status_code == HTTPStatus.OK:
        mock_generate_forms_download_attachments_task.assert_called_once()


@pytest.mark.parametrize(
    "rbac_roles, http_status_code, deleted",
    (
        ([UserRole.NORMAL, UserRole.RBAC_USER], HTTPStatus.OK, True),
        (
            [UserRole.RBAC_USER],
            HTTPStatus.OK,
            True,
        ),
        (
            [UserRole.GUEST],
            HTTPStatus.OK,
            True,
        ),
        (
            [UserRole.NORMAL],
            HTTPStatus.OK,
            True,
        ),
        ([UserRole.RBAC_USER], HTTPStatus.NOT_FOUND, False),
        ([UserRole.VIEW_STANDARDS], HTTPStatus.FORBIDDEN, True),
    ),
)
def test_delete_forms_downloads_attachments(
    rbac_roles,
    http_status_code,
    deleted,
    api_client,
    user_factory,
    form_filling_factory,
    mocker,
    check,
):
    """
    tests delete forms download attachments
    endpoint: DELETE /forms/downloads/attachments
    """
    # create user and view context used to perform the request
    user = user_factory(roles=rbac_roles)

    mock_delete_report = mocker.patch(
        "backendssc.modules.form_fillings.form_filling_service.FormFillingService.delete_report",
        return_value=deleted,
    )

    api_response = helpers.delete(
        api_client=api_client,
        path=f"/v2/forms/downloads/attachments",
        user=user,
        data=json.dumps({}),
        **{"feature_flags": {LDFeatureFlags.RBAC_QUESTIONNAIRES.value: True}},
    )

    # perform the checks
    check.equal(api_response.status_code, http_status_code)

    if http_status_code == HTTPStatus.NO_CONTENT:
        mock_delete_report.assert_called_once()


def test_get_form_smart_answers_stats(
    api_client,
    user_factory,
    form_filling_factory,
    standard_factory,
    check,
):
    """
    tests get smart answers execution stats for a specific form
    endpoint: /forms/{id}/smart_answers/stats
    """
    # create user and view context used to perform the request
    user = user_factory()
    user.add_role(UserRole.NORMAL)

    form = form_filling_factory(
        standard=standard_factory(), owner=user.company
    )

    form_uuid = get_entity_uuid(form)
    api_response = helpers.get(
        api_client=api_client,
        path=f"/v2/forms/{form_uuid}/smart_answers/status",
        user=user,
    )

    # perform the checks
    check.equal(api_response.status_code, HTTPStatus.OK)
    check.equal(
        api_response.data["entry"],
        SmartAnswersStatus(form_id=str(form_uuid)).to_map(),  # type:ignore
    )


def test_get_form_smart_answers_stats_wrong_permissions(
    api_client,
    user_factory,
    form_filling_factory,
    company_factory,
    standard_factory,
    check,
):
    """
    tests get smart answers execution stats for a specific form
    endpoint: /forms/{id}/smart_answers/stats
    without right permission:
     - we should get a Forbidden http error with 403 as status code.
    """
    # create user and view context used to perform the request
    user = user_factory()
    user.add_role(UserRole.NORMAL)

    form = form_filling_factory(
        standard=standard_factory(), owner=company_factory()
    )

    api_response = helpers.get(
        api_client=api_client,
        path=f"/v2/forms/{get_entity_uuid(form)}/smart_answers/status",
        user=user,
    )

    # perform the checks
    check.equal(api_response.status_code, HTTPStatus.FORBIDDEN)


@pytest.mark.parametrize(
    "save_answers",
    (True, False, None),
)
def test_post_forms_responses_smart_answers_ok(
    save_answers,
    api_client,
    user_factory,
    form_filling_factory,
    response_filling_factory,
    response_type_factory,
    response_definition_factory,
    company_factory,
    standard_factory,
    question_filling_factory,
    mocker,
    session,
    check,
):
    """
    tests POST smart answers execution for specific form and specific response
    endpoint: POST /forms/{id}/responses/{id}/smart_answers
    """
    # create user and view context used to perform the request
    user = user_factory()
    user.add_role(UserRole.NORMAL)
    form = form_filling_factory(
        standard=standard_factory(), owner=user.company
    )
    response_definition = response_definition_factory(
        dependent_questions=1,
    )
    question = question_filling_factory(
        owner=user.company,
        form=form,
        visible=True,
        active=True,
        question_code=response_definition.dependent_questions[0].question_code,
    )
    definition = response_type_factory(
        options=["YES", "NO"],
        response_type=ResponseType.SINGLE_SELECT,
    )
    response = response_filling_factory(
        owner=user.company,
        response_definition=response_definition,
        question=question,
        definition=definition,
        form=form,
    )

    form.responses = [response]
    form.questions = [question]
    session.commit()

    # mock smart answers api call/response
    similar = [
        {
            "id": 367683,
            "question_id": form.questions[0].id,
            "response_id": response.id,
            "form_id": form.id,
            "question": form.questions[0].question,
            "response": response.value,
            "cos_sim": 0.7615723875991913,
        },
    ]

    mocker.patch(
        "backendssc.modules.smart_answers.service.SmartAnswersService.get_smart_answer",
        return_value=SmartAnswerApiResponse.from_json(
            {
                "company_id": user.company.id,
                "question_id": form.questions[0].id,
                "response_id": form.responses[0].id,
                "form_id": form.id,
                "question": form.questions[0].question,
                "similar": similar,
                "smart_answer": definition.options[0],
                "status": "ok",
                "message": "ok",
                "smart_answer_unknown": "",
                "question_filling": form.questions[0],
                "response_filling": form.responses[0],
            },
        ),
    )

    # get the related entity ids to compare the endpoint output
    form_uuid = get_entity_uuid(form)
    response_uuid = get_entity_uuid(response)
    definition_uuid = get_entity_uuid(definition)

    response_to_map = response.to_map()
    response_to_map["mapping_history"] = None
    response_to_map["id"] = response_uuid
    response_to_map["definition"]["id"] = definition_uuid
    response_to_map["value"] = definition.options[0]
    response_id = response.id
    final_value = definition.options[0]

    payload = {}
    if save_answers is not None:
        payload["save_answers"] = save_answers

    api_response = helpers.post(
        api_client=api_client,
        path=f"/v2/forms/{form_uuid}/responses/{response_uuid}/smart_answers",
        user=user,
        data=json.dumps(payload),
    )

    # perform the checks
    response_res = (
        session.query(ResponseFilling).filter_by(id=response_id).first()
    )
    if save_answers:
        check.equal(response_res.value, final_value)

    check.equal(api_response.status_code, HTTPStatus.OK)
    check.equal(api_response.data["entry"], response_to_map)


def test_post_forms_responses_smart_answers_wrong_parameters(
    api_client,
    user_factory,
    form_filling_factory,
    response_filling_factory,
    response_type_factory,
    response_definition_factory,
    company_factory,
    standard_factory,
    check,
):
    """
    tests POST smart answers execution for with wrong parameters
    endpoint: POST /forms/{id}/responses/{id}/smart_answers
    - we should get Bad request 400 response.
    """
    # create user and view context used to perform the request
    user = user_factory()
    user.add_role(UserRole.NORMAL)

    # 1) should fail because invalid form
    form_uuid = uuid4()
    api_response = helpers.post(
        api_client=api_client,
        path=f"/v2/forms/{form_uuid}/responses/{uuid4()}/smart_answers",
        user=user,
        data=json.dumps({}),
    )

    # perform the checks
    check.equal(api_response.status_code, HTTPStatus.FORBIDDEN)

    # 2) should fail because invalid response
    user = user_factory()
    user.add_role(UserRole.NORMAL)
    form = form_filling_factory(
        standard=standard_factory(), owner=user.company
    )

    # should fail because invalid form
    form_uuid = get_entity_uuid(form)
    api_response = helpers.post(
        api_client=api_client,
        path=f"/v2/forms/{form_uuid}/responses/{uuid4()}/smart_answers",
        user=user,
        data=json.dumps({}),
    )

    # perform the checks
    check.equal(api_response.status_code, HTTPStatus.FORBIDDEN)


def test_delete_proxy_rbac_user_forbidden(
    api_client,
    user_factory,
    form_filling_factory,
    proxy_factory,
    check,
):
    # GIVEN
    user = user_factory()
    user.add_role(UserRole.RBAC_USER)
    form = form_filling_factory.create(owner=user.company)
    proxy = proxy_factory(owner=user.company, form=form)
    user_email = user.email
    # WHEN
    api_response = helpers.delete(
        api_client=api_client,
        path=f"/v2/forms/{get_entity_uuid(form)}/proxies/{get_entity_uuid(proxy)}",
        user=user,
        data=json.dumps({}),
        **{"feature_flags": {LDFeatureFlags.RBAC_QUESTIONNAIRES.value: True}},
    )

    # THEN
    check.is_in(
        f"User {user_email} is denied access as they are missing one or many of the following RBAC roles: "
        + "{UserRole.DELETE_COLLABORATORS}",
        api_response.data["message"],
    )
    check.equal(api_response.status_code, HTTPStatus.FORBIDDEN)


@pytest.mark.parametrize(
    "extra_rbac_roles, http_status_code",
    (
        ([], HTTPStatus.FORBIDDEN),
        ([UserRole.CREATE_QUESTIONNAIRE_MESSAGES], HTTPStatus.OK),
    ),
)
def test_create_message_rbac_user(
    api_client,
    user_factory,
    form_filling_factory,
    question_filling_factory,
    extra_rbac_roles,
    http_status_code,
    check,
):
    # GIVEN
    user = user_factory(
        roles=[UserRole.NORMAL, UserRole.RBAC_USER] + extra_rbac_roles
    )
    form = form_filling_factory.create(owner=user.company)
    question = question_filling_factory(owner=user.company, form=form)

    # WHEN
    api_response = helpers.post(
        api_client=api_client,
        path=f"/v2/forms/{get_entity_uuid(form)}/questions/{get_entity_uuid(question)}/comments",
        user=user,
        data=json.dumps({"text": "test"}),
        feature_flags={LDFeatureFlags.RBAC_QUESTIONNAIRES.value: True},
    )

    # THEN
    check.equal(api_response.status_code, http_status_code)
    if http_status_code == HTTPStatus.FORBIDDEN:
        check.is_in(
            "is denied access as they are missing one or many of the following "
            f"RBAC roles: {set([UserRole.CREATE_QUESTIONNAIRE_MESSAGES])}",
            api_response.data["message"],
        )


@pytest.mark.parametrize(
    "rbac_roles, should_view_comments",
    (
        ([], True),
        ([UserRole.RBAC_USER, UserRole.VIEW_RECEIVED_QUESTIONNAIRES], False),
        (
            [
                UserRole.RBAC_USER,
                UserRole.VIEW_RECEIVED_QUESTIONNAIRES,
                UserRole.VIEW_QUESTIONNAIRE_MESSAGES,
            ],
            True,
        ),
    ),
)
def test_read_question_messages_rbac_user(
    api_client,
    user_factory,
    form_filling_factory,
    form_filling_request_factory,
    question_filling_factory,
    question_comment_factory,
    question_filling_history_factory,
    response_filling_factory,
    response_filling_history_factory,
    evidence_link_factory,
    rbac_roles,
    should_view_comments,
    check,
    mocker,
):
    # GIVEN
    mocker.patch.object(
        MetadataService,
        "factor_description",
        lambda *_, **__: "test_description",
    )
    user = user_factory(roles=[UserRole.NORMAL] + rbac_roles)
    form = form_filling_factory(owner=user.company)
    issues_data = {
        "factors": [{"key": "test", "issues": [{"severity": "info"}]}]
    }

    # ssc_data block
    form_filling_request_factory(
        source_user=user, source=user.company, form=form
    )
    #
    question = question_filling_factory(
        owner=user.company,
        form=form,
        comment_count=1,
        # ssc_data block
        ssc_issues=issues_data,
        ssc_issues_count=1,
        #
        # attachments block
        attachment_count=1,
        #
        # history -> responses
        response_count=1,
        #
    )

    # history -> responses
    response = response_filling_factory(
        owner=user.company, form=form, question=question
    )
    response_filling_history_factory(
        user=user, company=user.company, response=response
    )
    #

    # attachments block
    evidence_link_factory(owner=user.company, form=form, question=question)
    #

    # comments block
    question_comment_factory(owner=user.company, form=form, question=question)
    #
    # history block
    question_filling_history_factory(
        user=user,
        company=user.company,
        form=form,
        question=question,
        history_type=QuestionFillingHistoryType.COMMENT.value,
    )
    question_filling_history_factory(
        user=user,
        company=user.company,
        form=form,
        question=question,
        history_type=QuestionFillingHistoryType.ATTACHMENT_ADD.value,
        data={
            "attachment_id": 1,
            "attachment_name": "test",
            "attachment_size": 1,
        },
    )
    question_filling_history_factory(
        user=user,
        company=user.company,
        form=form,
        question=question,
        history_type=QuestionFillingHistoryType.SSC_DATA.value,
        data=issues_data,
    )
    question_filling_history_factory(
        user=user,
        company=user.company,
        form=form,
        question=question,
        history_type=QuestionFillingHistoryType.RESPONSE.value,
        data=issues_data,
    )
    #

    # WHEN
    api_response = helpers.get(
        api_client=api_client,
        path=(
            f"/v2/forms/{get_entity_uuid(form)}/questions/{get_entity_uuid(question)}"
            "?blocks=attachments,comments,history,ssc_data"
        ),
        user=user,
        feature_flags={LDFeatureFlags.RBAC_QUESTIONNAIRES.value: True},
    )

    # THEN
    check.equal(api_response.status_code, HTTPStatus.OK)
    (check.is_true if should_view_comments else check.is_false)(
        api_response.data["entry"]["blocks_data"]["comments"]["data"]
    )
    check.equal(
        api_response.data["entry"]["blocks_meta"]["comments"],
        QuestionBlockMetadataStats(int(should_view_comments)).to_map(),
    )

    # make sure the other blocks are returning data
    check.equal(
        # only `VRM` can see `SSC_DATA`
        (
            {
                QuestionHistoryRecordType.COMMENT.name,
                QuestionHistoryRecordType.ATTACHMENT.name,
                QuestionHistoryRecordType.RESPONSE.name,
            }
            if should_view_comments
            else {
                QuestionHistoryRecordType.ATTACHMENT.name,
                QuestionHistoryRecordType.RESPONSE.name,
            }
        ),
        {
            data["type"]
            for data in api_response.data["entry"]["blocks_data"]["history"][
                "data"
            ]
        },
    )
    check.equal(
        api_response.data["entry"]["blocks_meta"]["history"],
        QuestionBlockMetadataStats(2).to_map(),
    )

    check.is_true(
        api_response.data["entry"]["blocks_data"]["ssc_data"]["factors"]
    )
    check.equal(
        api_response.data["entry"]["blocks_meta"]["ssc_data"],
        QuestionBlockMetadataStats(1).to_map(),
    )

    check.is_true(
        api_response.data["entry"]["blocks_data"]["attachments"]["data"]
    )
    check.equal(
        api_response.data["entry"]["blocks_meta"]["attachments"],
        QuestionBlockMetadataStats(1).to_map(),
    )


@pytest.mark.parametrize(
    "rbac_roles, should_view_comments",
    (
        ([], True),
        ([UserRole.RBAC_USER, UserRole.VIEW_SENT_QUESTIONNAIRES], False),
        (
            [
                UserRole.RBAC_USER,
                UserRole.VIEW_SENT_QUESTIONNAIRES,
                UserRole.VIEW_QUESTIONNAIRE_MESSAGES,
            ],
            True,
        ),
    ),
)
def test_read_question_messages_rbac_user_vrm(
    api_client,
    user_factory,
    form_filling_factory,
    form_filling_request_factory,
    question_filling_factory,
    question_comment_factory,
    question_filling_history_factory,
    response_filling_factory,
    response_filling_history_factory,
    evidence_link_factory,
    rbac_roles,
    should_view_comments,
    check,
    mocker,
):
    # GIVEN
    mocker.patch.object(
        MetadataService,
        "factor_description",
        lambda *_, **__: "test_description",
    )
    user = user_factory(roles=[UserRole.NORMAL] + rbac_roles)
    form = form_filling_factory(filling_type=FormFillingType.REQUEST.value)
    issues_data = {
        "factors": [{"key": "test", "issues": [{"severity": "info"}]}]
    }

    # ssc_data block
    form_filling_request_factory(
        source_user=user,
        source=user.company,
        form=form,
        status=FormFillingRequestStatus.VENDOR_IN_PROGRESS,
    )
    #
    question = question_filling_factory(
        owner=user.company,
        form=form,
        comment_count=1,
        # ssc_data block
        ssc_issues=issues_data,
        ssc_issues_count=1,
        #
        # attachments block
        attachment_count=1,
        #
        # history -> responses
        response_count=1,
        #
    )

    # history -> responses
    response = response_filling_factory(
        owner=user.company, form=form, question=question
    )
    response_filling_history_factory(
        user=user, company=user.company, response=response
    )
    # attachments block
    evidence_link_factory(owner=user.company, form=form, question=question)
    #

    # comments block
    question_comment_factory(owner=user.company, form=form, question=question)
    #
    # history block
    question_filling_history_factory(
        user=user,
        company=user.company,
        form=form,
        question=question,
        history_type=QuestionFillingHistoryType.COMMENT.value,
    )
    question_filling_history_factory(
        user=user,
        company=user.company,
        form=form,
        question=question,
        history_type=QuestionFillingHistoryType.ATTACHMENT_ADD.value,
        data={
            "attachment_id": 1,
            "attachment_name": "test",
            "attachment_size": 1,
        },
    )
    question_filling_history_factory(
        user=user,
        company=user.company,
        form=form,
        question=question,
        history_type=QuestionFillingHistoryType.SSC_DATA.value,
        data=issues_data,
    )
    #

    # WHEN
    api_response = helpers.get(
        api_client=api_client,
        path=(
            f"/v2/forms/{get_entity_uuid(form)}/questions/{get_entity_uuid(question)}"
            "?blocks=attachments,comments,history,ssc_data"
        ),
        user=user,
        feature_flags={LDFeatureFlags.RBAC_QUESTIONNAIRES.value: True},
    )

    # THEN
    check.equal(api_response.status_code, HTTPStatus.OK)
    (check.is_true if should_view_comments else check.is_false)(
        api_response.data["entry"]["blocks_data"]["comments"]["data"]
    )
    check.equal(
        api_response.data["entry"]["blocks_meta"]["comments"],
        QuestionBlockMetadataStats(int(should_view_comments)).to_map(),
    )

    # make sure the other blocks are returning data
    check.equal(
        # only `VENDOR` can see `ATTACHMENT` and `RESPONSE` at this state
        (
            {
                QuestionHistoryRecordType.COMMENT.name,
                QuestionHistoryRecordType.SSC_DATA.name,
            }
            if should_view_comments
            else {QuestionHistoryRecordType.SSC_DATA.name}
        ),
        {
            data["type"]
            for data in api_response.data["entry"]["blocks_data"]["history"][
                "data"
            ]
        },
    )
    check.equal(
        api_response.data["entry"]["blocks_meta"]["history"],
        QuestionBlockMetadataStats(1).to_map(),
    )

    check.is_true(
        api_response.data["entry"]["blocks_data"]["ssc_data"]["factors"]
    )
    check.equal(
        api_response.data["entry"]["blocks_meta"]["ssc_data"],
        QuestionBlockMetadataStats(1).to_map(),
    )

    check.is_false(
        api_response.data["entry"]["blocks_data"]["attachments"]["data"]
    )
    check.equal(
        api_response.data["entry"]["blocks_meta"]["attachments"],
        QuestionBlockMetadataStats(0).to_map(),
    )


@pytest.mark.parametrize(
    "rbac_roles, should_view_comments",
    (
        ([], True),
        ([UserRole.RBAC_USER, UserRole.VIEW_RECEIVED_QUESTIONNAIRES], False),
        (
            [
                UserRole.RBAC_USER,
                UserRole.VIEW_RECEIVED_QUESTIONNAIRES,
                UserRole.VIEW_QUESTIONNAIRE_MESSAGES,
            ],
            True,
        ),
    ),
)
def test_form_questions_read_messages_rbac_user(
    api_client,
    user_factory,
    form_filling_factory,
    form_filling_request_factory,
    question_filling_factory,
    question_comment_factory,
    question_filling_history_factory,
    response_filling_factory,
    response_filling_history_factory,
    evidence_link_factory,
    rbac_roles,
    should_view_comments,
    check,
    mocker,
):
    # GIVEN
    mocker.patch.object(
        MetadataService,
        "factor_description",
        lambda *_, **__: "test_description",
    )
    user = user_factory(roles=[UserRole.NORMAL] + rbac_roles)
    form = form_filling_factory(owner=user.company)
    issues_data = {
        "factors": [{"key": "test", "issues": [{"severity": "info"}]}]
    }

    # ssc_data block
    form_filling_request_factory(
        source_user=user, source=user.company, form=form
    )
    #
    question = question_filling_factory(
        owner=user.company,
        form=form,
        comment_count=1,
        # ssc_data block
        ssc_issues=issues_data,
        ssc_issues_count=1,
        #
        # attachments block
        attachment_count=1,
        #
        # history -> responses
        response_count=1,
        #
    )

    # history -> responses
    response = response_filling_factory(
        owner=user.company, form=form, question=question
    )
    response_filling_history_factory(
        user=user, company=user.company, response=response
    )
    #

    # attachments block
    evidence_link_factory(owner=user.company, form=form, question=question)
    #

    # comments block
    question_comment_factory(owner=user.company, form=form, question=question)
    #
    # history block
    question_filling_history_factory(
        user=user,
        company=user.company,
        form=form,
        question=question,
        history_type=QuestionFillingHistoryType.COMMENT.value,
    )
    question_filling_history_factory(
        user=user,
        company=user.company,
        form=form,
        question=question,
        history_type=QuestionFillingHistoryType.ATTACHMENT_ADD.value,
        data={
            "attachment_id": 1,
            "attachment_name": "test",
            "attachment_size": 1,
        },
    )
    question_filling_history_factory(
        user=user,
        company=user.company,
        form=form,
        question=question,
        history_type=QuestionFillingHistoryType.SSC_DATA.value,
        data=issues_data,
    )
    question_filling_history_factory(
        user=user,
        company=user.company,
        form=form,
        question=question,
        history_type=QuestionFillingHistoryType.RESPONSE.value,
        data=issues_data,
    )
    #

    # WHEN
    api_response = helpers.get(
        api_client=api_client,
        path=(
            f"/v2/forms/{get_entity_uuid(form)}/questions"
            "?blocks=attachments,comments,history,ssc_data"
        ),
        user=user,
        feature_flags={LDFeatureFlags.RBAC_QUESTIONNAIRES.value: True},
    )

    # THEN
    check.equal(api_response.status_code, HTTPStatus.OK)
    (check.is_true if should_view_comments else check.is_false)(
        api_response.data["entries"][0]["blocks_data"]["comments"]["data"]
    )
    check.equal(
        api_response.data["entries"][0]["blocks_meta"]["comments"],
        QuestionBlockMetadataStats(int(should_view_comments)).to_map(),
    )

    # make sure the other blocks are returning data
    check.equal(
        # only `VRM` can see `SSC_DATA`
        (
            {
                QuestionHistoryRecordType.COMMENT.name,
                QuestionHistoryRecordType.ATTACHMENT.name,
                QuestionHistoryRecordType.RESPONSE.name,
            }
            if should_view_comments
            else {
                QuestionHistoryRecordType.ATTACHMENT.name,
                QuestionHistoryRecordType.RESPONSE.name,
            }
        ),
        {
            data["type"]
            for data in api_response.data["entries"][0]["blocks_data"][
                "history"
            ]["data"]
        },
    )
    check.equal(
        api_response.data["entries"][0]["blocks_meta"]["history"],
        QuestionBlockMetadataStats(2).to_map(),
    )

    check.is_true(
        api_response.data["entries"][0]["blocks_data"]["ssc_data"]["factors"]
    )
    check.equal(
        api_response.data["entries"][0]["blocks_meta"]["ssc_data"],
        QuestionBlockMetadataStats(1).to_map(),
    )

    check.is_true(
        api_response.data["entries"][0]["blocks_data"]["attachments"]["data"]
    )
    check.equal(
        api_response.data["entries"][0]["blocks_meta"]["attachments"],
        QuestionBlockMetadataStats(1).to_map(),
    )


@pytest.mark.parametrize(
    "roles, form_permissions",
    (
        ([UserRole.GUEST], [FormPermission.FORM_AUTOCOMPLETE]),
        ([UserRole.NORMAL], [FormPermission.FORM_AUTOCOMPLETE]),
    ),
)
def test_get_form_autocomplete_permissions(
    api_client,
    user_factory,
    form_filling_factory,
    standard_factory,
    form_filling_request_factory,
    form_definition_factory,
    roles,
    form_permissions,
    check,
):
    """
    Test FORM_AUTOCOMPLETE permission be present in
    GET forms/{id} response for given UserRole:
    - GUEST
    - NORMAL
    we need this to support legacy "Autocomplete" in legacy atlas.
    """
    user = user_factory(roles=[UserRole.NORMAL])
    vendor = user_factory(roles=roles)
    form = form_filling_factory(
        owner=user.company,
        filling_type=FormFillingType.REQUEST.value,
        standard=standard_factory(
            definitions=[form_definition_factory(owner=user.company)],
        ),
    )
    form_filling_request_factory(
        source_user=user,
        source=user.company,
        target_user=vendor,
        form=form,
        status=FormFillingRequestStatus.CREATED,
        target=vendor.company,
    )

    # WHEN
    api_response = helpers.get(
        api_client=api_client,
        path=f"/v2/forms/{get_entity_uuid(form)}",
        user=vendor,
    )

    # THEN
    check.equal(api_response.status_code, HTTPStatus.OK)
    check.is_true(
        all(
            p.value in api_response.data["entry"]["form"]["permissions"]
            for p in form_permissions
        )
    )


@pytest.mark.parametrize(
    "sort,expected_http_status",
    (
        ("user_email", HTTPStatus.OK),
        ("-user_email", HTTPStatus.OK),
        ("action", HTTPStatus.OK),
        ("-action", HTTPStatus.OK),
        ("created_at", HTTPStatus.OK),
        ("-created_at", HTTPStatus.OK),
        ("invalid_sort", HTTPStatus.BAD_REQUEST),
    ),
)
def test_form_response_history_validate_sort(
    api_client,
    user_factory,
    response_filling_history_factory,
    check,
    sort,
    expected_http_status,
    mocker,
):
    # GIVEN
    user = user_factory(roles=[UserRole.NORMAL])
    rfh = response_filling_history_factory(
        created_at=faker.past_datetime(tzinfo=timezone.utc),
        action=ResponseFillingHistoryAction.MANUAL_INPUT.value,
        company=user.company,
    )
    mocker.patch(
        "backendssc.modules.form_fillings.form_filling_repository.FormFillingRepository.count_responses_history",
        return_value=0,
    )
    mocker.patch(
        "backendssc.modules.form_fillings.form_filling_repository.FormFillingRepository.get_responses_history",
        return_value=[],
    )
    form_id = to_uuidv4(entity="FF", entity_id=rfh.response.form.id)

    # WHEN
    api_response = helpers.get(
        api_client=api_client,
        path=f"/v2/forms/{form_id}/responses/history?sort={sort}",
        user=user,
    )

    # THEN
    check.equal(api_response.status_code, expected_http_status)


@pytest.mark.parametrize("direction", ("ASC", "DESC"))
def test_form_response_history_sort_by_user_email(
    api_client,
    user_factory,
    response_filling_factory,
    response_filling_history_factory,
    direction,
    check,
):
    # GIVEN
    user1 = user_factory(roles=[UserRole.NORMAL])
    user2 = user_factory(
        roles=[UserRole.NORMAL],
        company=user1.company,
    )

    min_email = min(user1.email, user2.email)
    max_email = max(user1.email, user2.email)

    rf = response_filling_factory.create(owner=user1.company)
    response_filling_history_factory.create_batch(
        size=5,
        created_at=faker.past_datetime(tzinfo=timezone.utc),
        action=ResponseFillingHistoryAction.PROPAGATE_FROM_MASTER_FORM.value,
        company=user1.company,
        response=rf,
        user=user1,
    )
    response_filling_history_factory.create_batch(
        size=5,
        created_at=faker.past_datetime(tzinfo=timezone.utc),
        action=ResponseFillingHistoryAction.COPY_FROM_RESPONSE.value,
        company=user2.company,
        response=rf,
        user=user2,
    )

    form_id = to_uuidv4(entity="FF", entity_id=rf.form.id)
    # WHEN
    api_response = helpers.get(
        api_client=api_client,
        path=f"/v2/forms/{form_id}/responses/history?sort={'-' if direction == 'DESC' else ''}user_email",
        user=user1,
    )
    # THEN
    check.equal(api_response.status_code, HTTPStatus.OK)
    check.equal(len(api_response.data["entries"]), 10)
    check.equal(
        api_response.data["entries"][0]["user_email"],
        max_email if direction == "DESC" else min_email,
    )
    check.equal(api_response.data["pagination_stats"]["total_count"], 10)


@pytest.mark.parametrize("direction", ("ASC", "DESC"))
def test_form_response_history_sort_by_action(
    api_client,
    user_factory,
    response_filling_factory,
    response_filling_history_factory,
    direction,
    check,
):
    # GIVEN
    user1 = user_factory(roles=[UserRole.NORMAL])
    rf = response_filling_factory.create(owner=user1.company)
    response_filling_history_factory.create_batch(
        size=5,
        created_at=faker.past_datetime(tzinfo=timezone.utc),
        action=ResponseFillingHistoryAction.PROPAGATE_FROM_MASTER_FORM.value,
        company=user1.company,
        response=rf,
        user=user1,
    )
    response_filling_history_factory.create_batch(
        size=5,
        created_at=faker.past_datetime(tzinfo=timezone.utc),
        action=ResponseFillingHistoryAction.COPY_FROM_RESPONSE.value,
        company=user1.company,
        response=rf,
        user=user1,
    )

    form_id = to_uuidv4(entity="FF", entity_id=rf.form.id)

    # WHEN
    api_response = helpers.get(
        api_client=api_client,
        path=f"/v2/forms/{form_id}/responses/history?sort={'-' if direction == 'DESC' else ''}action",
        user=user1,
    )
    # THEN
    check.equal(api_response.status_code, HTTPStatus.OK)
    check.equal(len(api_response.data["entries"]), 10)
    check.equal(
        api_response.data["entries"][0]["action"],
        (
            ResponseFillingHistoryAction.PROPAGATE_FROM_MASTER_FORM.value
            if direction == "DESC"
            else ResponseFillingHistoryAction.COPY_FROM_RESPONSE.value
        ),
    )
    check.equal(api_response.data["pagination_stats"]["total_count"], 10)


@pytest.mark.parametrize("direction", ("ASC", "DESC"))
def test_form_response_history_sort_by_created_at(
    api_client,
    user_factory,
    response_filling_factory,
    response_filling_history_factory,
    direction,
    check,
):
    # GIVEN
    user1 = user_factory(roles=[UserRole.NORMAL])
    past_created_date = datetime.today() - timedelta(days=1)
    today = datetime.today()
    rf = response_filling_factory.create(owner=user1.company)
    response_filling_history_factory.create_batch(
        size=5,
        created_at=past_created_date,
        action=ResponseFillingHistoryAction.PROPAGATE_FROM_MASTER_FORM.value,
        company=user1.company,
        response=rf,
        user=user1,
    )
    response_filling_history_factory.create_batch(
        size=5,
        created_at=today,
        action=ResponseFillingHistoryAction.COPY_FROM_RESPONSE.value,
        company=user1.company,
        response=rf,
        user=user1,
    )
    form_id = to_uuidv4(entity="FF", entity_id=rf.form.id)

    # WHEN
    api_response = helpers.get(
        api_client=api_client,
        path=f"/v2/forms/{form_id}/responses/history?sort={'-' if direction == 'DESC' else ''}created_at",
        user=user1,
    )
    # THEN
    check.equal(api_response.status_code, HTTPStatus.OK)
    check.equal(len(api_response.data["entries"]), 10)
    check.equal(
        api_response.data["entries"][0]["created_at"],
        (
            datetime_to_iso8601(today)
            if direction == "DESC"
            else datetime_to_iso8601(past_created_date)
        ),
    )
    check.equal(api_response.data["pagination_stats"]["total_count"], 10)


def test_form_response_history_size(
    api_client,
    user_factory,
    response_filling_factory,
    response_filling_history_factory,
    check,
):
    # GIVEN
    user1 = user_factory(roles=[UserRole.NORMAL])
    past_created_date = datetime.today() - timedelta(days=1)
    today = datetime.today()
    rf = response_filling_factory.create(owner=user1.company)
    response_filling_history_factory.create_batch(
        size=5,
        created_at=past_created_date,
        action=ResponseFillingHistoryAction.PROPAGATE_FROM_MASTER_FORM.value,
        company=user1.company,
        response=rf,
        user=user1,
    )
    response_filling_history_factory.create_batch(
        size=5,
        created_at=today,
        action=ResponseFillingHistoryAction.COPY_FROM_RESPONSE.value,
        company=user1.company,
        response=rf,
        user=user1,
    )
    form_id = to_uuidv4(entity="FF", entity_id=rf.form.id)
    # WHEN
    api_response = helpers.get(
        api_client=api_client,
        path=f"/v2/forms/{form_id}/responses/history?size=1",
        user=user1,
    )

    # THEN
    check.equal(api_response.status_code, HTTPStatus.OK)
    check.equal(len(api_response.data["entries"]), 1)
    check.equal(api_response.data["pagination_stats"]["total_count"], 10)


@pytest.mark.parametrize("page", (0, 1))
def test_form_response_history_page(
    api_client,
    user_factory,
    response_filling_factory,
    response_filling_history_factory,
    page,
    check,
):
    # GIVEN
    user1 = user_factory(roles=[UserRole.NORMAL])
    past_created_date = datetime.today() - timedelta(days=1)
    today = datetime.today()
    rf = response_filling_factory.create(owner=user1.company)
    response_filling_history_factory.create_batch(
        size=5,
        created_at=past_created_date,
        action=ResponseFillingHistoryAction.PROPAGATE_FROM_MASTER_FORM.value,
        company=user1.company,
        response=rf,
        user=user1,
    )
    response_filling_history_factory.create_batch(
        size=5,
        created_at=today,
        action=ResponseFillingHistoryAction.COPY_FROM_RESPONSE.value,
        company=user1.company,
        response=rf,
        user=user1,
    )
    form_id = to_uuidv4(entity="FF", entity_id=rf.form.id)
    # WHEN
    api_response = helpers.get(
        api_client=api_client,
        path=f"/v2/forms/{form_id}/responses/history?size=5&page={page}&sort=-action",
        user=user1,
    )

    # THEN
    check.equal(api_response.status_code, HTTPStatus.OK)
    check.equal(len(api_response.data["entries"]), 5)
    check.equal(
        api_response.data["entries"][0]["action"],
        (
            ResponseFillingHistoryAction.PROPAGATE_FROM_MASTER_FORM.value
            if page == 0
            else ResponseFillingHistoryAction.COPY_FROM_RESPONSE.value
        ),
    )
    check.equal(api_response.data["pagination_stats"]["total_count"], 10)


@pytest.mark.parametrize(
    "email_search,should_include",
    ((faker.email(), True), (faker.email(), False)),
)
def test_form_response_history_search_user_email(
    api_client,
    user_factory,
    response_filling_factory,
    response_filling_history_factory,
    email_search,
    should_include,
    session,
    check,
):
    # GIVEN
    user1 = user_factory(roles=[UserRole.NORMAL])
    if should_include:
        user1.email = email_search
        session.commit()

    past_created_date = datetime.today() - timedelta(days=1)
    rf = response_filling_factory.create(owner=user1.company)
    response_filling_history_factory.create_batch(
        size=5,
        created_at=past_created_date,
        action=ResponseFillingHistoryAction.PROPAGATE_FROM_MASTER_FORM.value,
        company=user1.company,
        response=rf,
        user=user1,
    )
    form_id = to_uuidv4(entity="FF", entity_id=rf.form.id)

    # WHEN
    api_response = helpers.get(
        api_client=api_client,
        path=f"/v2/forms/{form_id}/responses/history?search={email_search}",
        user=user1,
    )

    # THEN
    check.equal(api_response.status_code, HTTPStatus.OK)
    check.equal(len(api_response.data["entries"]), 5 if should_include else 0)
    if should_include:
        for entry in api_response.data["entries"]:
            check.equal(entry["user_email"], email_search)

    check.equal(
        api_response.data["pagination_stats"]["total_count"],
        5 if should_include else 0,
    )


@pytest.mark.parametrize(
    "question,should_include",
    ((faker.sentence(), True), (faker.sentence(), False)),
)
def test_form_response_history_search_question(
    api_client,
    user_factory,
    response_filling_factory,
    response_filling_history_factory,
    question,
    should_include,
    session,
    check,
):
    # GIVEN
    user1 = user_factory(roles=[UserRole.NORMAL])
    past_created_date = datetime.today() - timedelta(days=1)
    rf = response_filling_factory.create(owner=user1.company)
    response_filling_history_factory.create_batch(
        size=5,
        created_at=past_created_date,
        action=ResponseFillingHistoryAction.PROPAGATE_FROM_MASTER_FORM.value,
        company=user1.company,
        response=rf,
        user=user1,
    )
    if should_include:
        rf.question.question = question
        session.commit()

    form_id = to_uuidv4(entity="FF", entity_id=rf.form.id)

    # WHEN
    api_response = helpers.get(
        api_client=api_client,
        path=f"/v2/forms/{form_id}/responses/history?search={question}",
        user=user1,
    )

    # THEN
    check.equal(api_response.status_code, HTTPStatus.OK)
    check.equal(len(api_response.data["entries"]), 5 if should_include else 0)
    if should_include:
        for entry in api_response.data["entries"]:
            check.equal(
                entry["question"],
                question,
            )

    check.equal(
        api_response.data["pagination_stats"]["total_count"],
        5 if should_include else 0,
    )


@pytest.mark.parametrize(
    "search,should_include",
    (
        (ResponseFillingHistoryAction.PROPAGATE_FROM_MASTER_FORM.value, True),
        (ResponseFillingHistoryAction.COPY_FROM_RESPONSE.value, True),
        (ResponseFillingHistoryAction.COPY_FROM_FORM.value, False),
        (ResponseFillingHistoryAction.MANUAL_INPUT.value, False),
        (
            ResponseFillingHistoryAction.MANUAL_ANSWER_LOOKUP_LENSES.value,
            False,
        ),
        (ResponseFillingHistoryAction.MANUAL_AUTOCOMPLETE.value, False),
        (ResponseFillingHistoryAction.MANUAL_MERGE_UPLOADED_FILE.value, False),
        (ResponseFillingHistoryAction.CLEAR_AFTER_COPY.value, False),
        (ResponseFillingHistoryAction.FILL_MASTER_FORM.value, False),
        (ResponseFillingHistoryAction.MAPPING_STATIC.value, False),
        (ResponseFillingHistoryAction.MAPPING_FUZZY.value, False),
        (ResponseFillingHistoryAction.MAPPING_FUZZY_BATCH.value, False),
        (ResponseFillingHistoryAction.MANUAL_BATCH_ERASE.value, False),
        (ResponseFillingHistoryAction.SMART_ANSWER.value, False),
    ),
)
def test_form_response_history_search_action(
    search,
    should_include,
    api_client,
    user_factory,
    response_filling_factory,
    response_filling_history_factory,
    check,
):
    # GIVEN
    user1 = user_factory(roles=[UserRole.NORMAL])
    past_created_date = datetime.today() - timedelta(days=1)
    today = datetime.today()
    rf = response_filling_factory.create(owner=user1.company)
    response_filling_history_factory.create_batch(
        size=5,
        created_at=past_created_date,
        action=ResponseFillingHistoryAction.PROPAGATE_FROM_MASTER_FORM.value,
        company=user1.company,
        response=rf,
        user=user1,
    )
    response_filling_history_factory.create_batch(
        size=5,
        created_at=today,
        action=ResponseFillingHistoryAction.COPY_FROM_RESPONSE.value,
        company=user1.company,
        response=rf,
        user=user1,
    )
    form_id = to_uuidv4(entity="FF", entity_id=rf.form.id)

    # WHEN
    api_response = helpers.get(
        api_client=api_client,
        path=f"/v2/forms/{form_id}/responses/history?search={search}",
        user=user1,
    )

    # THEN
    check.equal(api_response.status_code, HTTPStatus.OK)
    check.equal(len(api_response.data["entries"]), 5 if should_include else 0)
    if should_include:
        check.equal(
            api_response.data["entries"][0]["action"],
            search,
        )

    check.equal(
        api_response.data["pagination_stats"]["total_count"],
        5 if should_include else 0,
    )


def test_form_response_history_should_raise_error_if_page_index_is_wrong(
    api_client,
    user_factory,
    response_filling_factory,
    response_filling_history_factory,
    check,
):
    # GIVEN
    user1 = user_factory(roles=[UserRole.NORMAL])
    past_created_date = datetime.today() - timedelta(days=1)
    rf = response_filling_factory.create(owner=user1.company)
    response_filling_history_factory.create_batch(
        size=5,
        created_at=past_created_date,
        action=ResponseFillingHistoryAction.PROPAGATE_FROM_MASTER_FORM.value,
        company=user1.company,
        response=rf,
        user=user1,
    )
    form_id = to_uuidv4(entity="FF", entity_id=rf.form.id)

    # WHEN
    api_response = helpers.get(
        api_client=api_client,
        path=f"/v2/forms/{form_id}/responses/history?page=1",
        user=user1,
    )

    # THEN
    check.equal(api_response.status_code, HTTPStatus.BAD_REQUEST)


def test_get_attachment(
    api_client,
    form_filling_factory,
    user_factory,
    evidence_file_factory,
    evidence_link_factory,
    check,
):
    # GIVEN
    user = user_factory(roles=[UserRole.NORMAL])

    form = form_filling_factory(owner=user.company)

    evidence = evidence_file_factory()
    evidence_link_factory(evidence=evidence, form=form)

    # WHEN
    api_response = helpers.get(
        api_client=api_client,
        path=f"/v2/forms/{get_entity_uuid(form)}/attachments/{get_entity_uuid(evidence)}",
        user=user,
    )

    # THEN
    check.equal(api_response.status_code, HTTPStatus.OK)
    check.equal(
        api_response.data["entry"]["virus_scan_status"],
        EvidenceFileVirusScanStatus.NOT_APPLICABLE.value,
    )
