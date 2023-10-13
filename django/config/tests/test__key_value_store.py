from time import monotonic, sleep

import pytest

from ..key_value_store import RedisBackendWInMemoryCache


@pytest.fixture
def redis_backend(redisdb):
    return RedisBackendWInMemoryCache(
        url=f"unix:/{redisdb.connection_pool.connection_kwargs['path']}", timeout=60
    )


def test__redis_backend__do_not_set_memory_cache_if_value_not_in_db(redis_backend):
    # GIVEN

    # WHEN
    redis_backend.get("test")

    # THEN
    assert redis_backend._cache == {}


@pytest.mark.freeze_time
def test__redis_backend__set_memory_cache(redis_backend):
    # GIVEN
    redis_backend.set("test", 1)

    # WHEN
    result = redis_backend.get("test")

    # THEN
    assert result == 1
    assert redis_backend._cache == {
        "test": {"expire": monotonic() + redis_backend.timeout, "value": 1}
    }


def test__redis_backend__use_memory_cache(redis_backend, mocker):
    # GIVEN
    redis_get_mocked = mocker.patch("config.key_value_store.RedisBackend.get", return_value=1)
    redis_backend.set("test", 1)

    # WHEN
    redis_backend.get("test")
    redis_backend.get("test")
    redis_backend.get("test")
    redis_backend.get("test")

    # THEN
    assert not redis_get_mocked.called


def test__redis_backend__renew_memory_cache(redis_backend, mocker):
    # GIVEN
    redis_get_mocked = mocker.patch("config.key_value_store.RedisBackend.get", return_value=2)

    redis_backend.timeout = 1  # it's the smallest possible value
    redis_backend.set("test", 1)

    # WHEN
    redis_backend.get("test")  # hit memory cache
    sleep(1)
    redis_backend.get("test")  # hit redis + update memory cache
    result = redis_backend.get("test")  # hit memory cache

    # THEN
    assert redis_get_mocked.call_count == 1
    assert redis_backend._cache["test"]["value"] == result == 2
