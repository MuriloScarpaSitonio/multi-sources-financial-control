FROM python:3.8-buster

ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends build-essential gcc

WORKDIR /app/django

#COPY ./poetry.lock ./poetry.lock
COPY ./pyproject.toml ./pyproject.toml
RUN pip install poetry

RUN poetry config virtualenvs.create false && poetry install --no-dev --no-interaction

COPY ./entrypoint.sh /app/django/entrypoint.sh

RUN chmod +x /app/django/entrypoint.sh
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]