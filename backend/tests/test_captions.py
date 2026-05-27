"""Tests for services/captions.py"""
import sys
import json
from unittest.mock import MagicMock

# ── Block external deps before import ─────────────────────────────────────────
_mock_claude  = MagicMock()
_mock_anthro  = MagicMock()
_mock_anthro.Anthropic.return_value = _mock_claude

_mock_settings = MagicMock()
_mock_settings.ANTHROPIC_API_KEY = "test-key"
_mock_settings.MOCK_AI = False

_mock_mocks = MagicMock()
_mock_mocks.mock_post_captions.side_effect = \
    lambda n: [{"caption": f"Mock {i}", "hashtags": []} for i in range(n)]
_mock_mocks.mock_carousel_caption.return_value = {"caption": "Mock carousel", "hashtags": []}

sys.modules["anthropic"]      = _mock_anthro
sys.modules["config"]         = MagicMock(settings=_mock_settings)
sys.modules["services._mocks"] = _mock_mocks

import pytest
from services.captions import (
    generate_post_captions,
    generate_carousel_caption,
    _parse_json_response,
    _system_prompt,
    _business_context_text,
)

_BIZ = {
    "name": "Sunrise Café",
    "business_type": "café",
    "brand_tone": "warm and cozy",
    "business_context": {"location": "downtown", "specialty": "flat whites"},
}
_MEDIA = [{"media_url": "https://cdn.example.com/photo.jpg"}]


class TestParseJsonResponse:
    def test_plain_json_array(self):
        result = _parse_json_response('[{"caption":"Hello","hashtags":["a"]}]')
        assert result[0]["caption"] == "Hello"

    def test_plain_json_object(self):
        result = _parse_json_response('{"caption":"Hi","hashtags":[]}')
        assert result["caption"] == "Hi"

    def test_strips_json_code_fence(self):
        raw = '```json\n[{"caption":"Fenced"}]\n```'
        assert _parse_json_response(raw)[0]["caption"] == "Fenced"

    def test_strips_plain_code_fence(self):
        raw = '```\n{"caption":"Plain fence"}\n```'
        assert _parse_json_response(raw)["caption"] == "Plain fence"

    def test_raises_on_invalid_json(self):
        with pytest.raises(Exception):
            _parse_json_response("not json")


class TestBusinessContextText:
    def test_formats_key_value_pairs(self):
        biz  = {"business_context": {"location": "downtown", "specialty": "coffee"}}
        text = _business_context_text(biz)
        assert "location: downtown" in text
        assert "specialty: coffee" in text

    def test_no_context_empty_dict(self):
        assert "No additional context" in _business_context_text({"business_context": {}})

    def test_no_context_missing_key(self):
        assert "No additional context" in _business_context_text({})


class TestSystemPrompt:
    def test_contains_business_name(self):
        assert "Sunrise Café" in _system_prompt(_BIZ, "instruction")

    def test_contains_business_type(self):
        assert "café" in _system_prompt(_BIZ, "instruction")

    def test_contains_brand_tone(self):
        assert "warm and cozy" in _system_prompt(_BIZ, "instruction")

    def test_contains_instruction(self):
        assert "MY_UNIQUE_INSTRUCTION" in _system_prompt(_BIZ, "MY_UNIQUE_INSTRUCTION")

    def test_contains_context_values(self):
        assert "flat whites" in _system_prompt(_BIZ, "instruction")

    def test_falls_back_when_type_missing(self):
        biz = {**_BIZ}
        del biz["business_type"]
        assert "business" in _system_prompt(biz, "instruction")


class TestGeneratePostCaptionsMockMode:
    def setup_method(self):
        _mock_settings.MOCK_AI = True
        _mock_claude.reset_mock()

    def teardown_method(self):
        _mock_settings.MOCK_AI = False

    def test_returns_correct_count(self):
        assert len(generate_post_captions(_BIZ, _MEDIA * 3)) == 3

    def test_does_not_call_claude(self):
        generate_post_captions(_BIZ, _MEDIA)
        _mock_claude.messages.create.assert_not_called()

    def test_items_have_caption_and_hashtags(self):
        for item in generate_post_captions(_BIZ, _MEDIA * 2):
            assert "caption" in item
            assert "hashtags" in item


class TestGenerateCarouselCaptionMockMode:
    def setup_method(self):
        _mock_settings.MOCK_AI = True
        _mock_claude.reset_mock()

    def teardown_method(self):
        _mock_settings.MOCK_AI = False

    def test_returns_single_dict(self):
        result = generate_carousel_caption(_BIZ, _MEDIA * 2)
        assert isinstance(result, dict) and "caption" in result

    def test_does_not_call_claude(self):
        generate_carousel_caption(_BIZ, _MEDIA)
        _mock_claude.messages.create.assert_not_called()


class TestGeneratePostCaptionsRealMode:
    def setup_method(self):
        _mock_settings.MOCK_AI = False

    def _stub_claude(self, text):
        msg = MagicMock()
        msg.content = [MagicMock(text=text)]
        _mock_claude.messages.create.return_value = msg

    def test_calls_correct_model(self):
        self._stub_claude('[{"caption":"Test","hashtags":[]}]')
        generate_post_captions(_BIZ, _MEDIA)
        kwargs = _mock_claude.messages.create.call_args.kwargs
        assert kwargs["model"] == "claude-sonnet-4-20250514"

    def test_includes_all_photos_as_image_blocks(self):
        self._stub_claude('[{"caption":"a","hashtags":[]},{"caption":"b","hashtags":[]}]')
        generate_post_captions(_BIZ, _MEDIA * 2)
        content = _mock_claude.messages.create.call_args.kwargs["messages"][0]["content"]
        image_blocks = [b for b in content if b.get("type") == "image"]
        assert len(image_blocks) == 2

    def test_parses_and_returns_response(self):
        self._stub_claude('[{"caption":"My cap","hashtags":["coffee"]}]')
        result = generate_post_captions(_BIZ, _MEDIA)
        assert result[0]["caption"] == "My cap"
        assert result[0]["hashtags"] == ["coffee"]

    def test_passes_system_prompt_with_biz_name(self):
        self._stub_claude('[{"caption":"x","hashtags":[]}]')
        generate_post_captions(_BIZ, _MEDIA)
        system = _mock_claude.messages.create.call_args.kwargs["system"]
        assert "Sunrise Café" in system


class TestGenerateCarouselCaptionRealMode:
    def setup_method(self):
        _mock_settings.MOCK_AI = False

    def _stub_claude(self, text):
        msg = MagicMock()
        msg.content = [MagicMock(text=text)]
        _mock_claude.messages.create.return_value = msg

    def test_calls_correct_model(self):
        self._stub_claude('{"caption":"Carousel cap","hashtags":[]}')
        generate_carousel_caption(_BIZ, _MEDIA * 3)
        assert _mock_claude.messages.create.call_args.kwargs["model"] == "claude-sonnet-4-20250514"

    def test_sends_all_slides_as_image_blocks(self):
        self._stub_claude('{"caption":"All slides","hashtags":[]}')
        generate_carousel_caption(_BIZ, _MEDIA * 4)
        content = _mock_claude.messages.create.call_args.kwargs["messages"][0]["content"]
        image_blocks = [b for b in content if b.get("type") == "image"]
        assert len(image_blocks) == 4

    def test_returns_single_object_with_caption_and_hashtags(self):
        self._stub_claude('{"caption":"One cap","hashtags":["travel","food"]}')
        result = generate_carousel_caption(_BIZ, _MEDIA * 2)
        assert result["caption"] == "One cap"
        assert result["hashtags"] == ["travel", "food"]
