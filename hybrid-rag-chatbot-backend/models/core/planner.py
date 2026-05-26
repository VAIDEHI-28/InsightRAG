import json
import re
from llm.llm_client import generate


class Planner:
    """
    Pure planner.

    Responsibilities ONLY:
    1. Ask LLM for structured plan
    2. Normalize filters
    3. Validate format

    NO business logic.
    NO hardcoded rules.
    """

    def __init__(self, schema, prompt):
        self.schema = schema
        self.prompt = prompt

    # =================================================
    # Normalize ALL filter styles → (op, value)
    # =================================================
    def _normalize_condition(self, value):

        # already numeric
        if isinstance(value, (int, float)):
            return value

        # dict formats
        if isinstance(value, dict):

            op_map = {
                "lt": "<",
                "gt": ">",
                "lte": "<=",
                "gte": ">=",
                "eq": "==",
                "neq": "!=",
            }

            # {"operator": "lt", "value": 100}
            if "operator" in value and "value" in value:
                return (op_map.get(value["operator"], "=="), float(value["value"]))

            # {"gt": 100}
            for k, v in value.items():
                if k in op_map:
                    return (op_map[k], float(v))

        # string formats "<100"
        if isinstance(value, str):
            m = re.match(r"(<=|>=|<|>|!=)?\s*(\d+(\.\d+)?)", value.strip())
            if m:
                return (m.group(1) or "==", float(m.group(2)))

        return value

    # =================================================
    # Main
    # =================================================
    def plan(self, question):

        schema_text = "\n".join([f"{k} → {v}" for k, v in self.schema.items()])
        full_prompt = self.prompt.replace("{schema}", schema_text)

        response = generate(full_prompt + "\nQuestion: " + question)

        raw = response.strip().replace("```json", "").replace("```", "")

        try:
            plan = json.loads(raw)

        except Exception:
            return {"type": "explain"}

        # ---------- normalize ----------
        plan["type"] = plan.get("type", "explain").lower()
        plan["operation"] = plan.get("operation")
        plan["metric"] = plan.get("metric")
        plan["groupby"] = plan.get("groupby")
        plan["limit"] = plan.get("limit")
        plan["sort"] = plan.get("sort")

        filters = plan.get("filters") or {}

        normalized = {}
        for k, v in filters.items():
            normalized[k] = self._normalize_condition(v)

        plan["filters"] = normalized

        return plan
