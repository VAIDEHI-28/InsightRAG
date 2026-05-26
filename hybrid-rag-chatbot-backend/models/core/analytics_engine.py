import pandas as pd
import re


class AnalyticsEngine:
    """
    Pure analytics executor.

    Responsibilities ONLY:
    • apply filters
    • perform aggregation
    • return correctly shaped results

    NEVER:
    • generate text
    • format sentences
    • use LLM
    """

    # =================================================
    # INIT
    # =================================================
    def __init__(self, df, schema):
        self.df = df

        # Build normalized semantic map once
        self.semantic_map = {}

        for semantic_key, real_column in schema.items():
            normalized = self._normalize_key(semantic_key)
            self.semantic_map[normalized] = real_column

    # =================================================
    # NORMALIZATION
    # =================================================
    def _normalize_key(self, text: str) -> str:
        text = str(text).lower().strip()
        text = re.sub(r"[ _\-()]", "", text)
        return text

    def _normalize_value(self, value):
        """Normalize values for safe intersection comparison."""
        return str(value).strip().lower()

    # =================================================
    # ROBUST COLUMN RESOLVER
    # =================================================
    def _real_col(self, key):

        if not key:
            raise KeyError("Empty semantic key")

        normalized = self._normalize_key(key)

        # 1️⃣ Semantic schema match
        if normalized in self.semantic_map:
            return self.semantic_map[normalized]

        # 2️⃣ Direct dataframe column match
        for col in self.df.columns:
            if self._normalize_key(col) == normalized:
                return col

        raise KeyError(f"Semantic key '{key}' not found in schema")

    # =================================================
    # FILTERING
    # =================================================
    def _apply_filters(self, df, filters):

        if not filters:
            return df

        # AND logic
        if "AND" in filters:
            for condition in filters["AND"]:
                df = self._apply_filters(df, condition)
            return df

        # OR logic
        if "OR" in filters:
            frames = []
            for condition in filters["OR"]:
                frames.append(self._apply_filters(self.df.copy(), condition))
            return pd.concat(frames).drop_duplicates()

        # Simple filter
        for semantic_key, condition in filters.items():

            real_col = self._real_col(semantic_key)

            if isinstance(condition, list) and len(condition) == 2:
                condition = tuple(condition)

            # Numeric comparisons
            if isinstance(condition, tuple):
                op, value = condition
                value = float(value)

                if op == "<":
                    df = df[df[real_col] < value]
                elif op == ">":
                    df = df[df[real_col] > value]
                elif op == "<=":
                    df = df[df[real_col] <= value]
                elif op == ">=":
                    df = df[df[real_col] >= value]
                elif op == "==":
                    df = df[df[real_col] == value]
                elif op == "!=":
                    df = df[df[real_col] != value]

            # Case-insensitive exact text match
            else:
                value = str(condition).strip().lower()

                df = df[
                    df[real_col]
                    .astype(str)
                    .str.strip()
                    .str.lower()
                    .str.contains(value, na=False)
                ]

        return df

    # =================================================
    # PIPELINE EXECUTION
    # =================================================
    def run_pipeline(self, steps):

        results = []

        for step in steps:
            results.append(self.run(step))

        # ------------------------------------------
        # INTERSECTION LOGIC (FIXED PERMANENTLY)
        # ------------------------------------------
        if (
            len(steps) == 2
            and steps[0]["operation"] == "list_unique"
            and steps[1]["operation"] == "list_unique"
            and self._normalize_key(steps[0]["metric"]) ==
                self._normalize_key(steps[1]["metric"])
        ):

            # Normalize before intersecting
            set1_normalized = {
                self._normalize_value(list(d.values())[0])
                for d in results[0]
            }

            set2_normalized = {
                self._normalize_value(list(d.values())[0])
                for d in results[1]
            }

            common_normalized = set1_normalized.intersection(set2_normalized)

            # Restore original casing from first result
            original_map = {
                self._normalize_value(list(d.values())[0]): list(d.values())[0]
                for d in results[0]
            }

            common = sorted(
                [original_map[val] for val in common_normalized]
            )

            metric = steps[0]["metric"]
            return [{metric: v} for v in common]

        # ------------------------------------------
        # MAX + ARGMAX COMBINATION
        # ------------------------------------------
        if (
            len(steps) == 2
            and steps[0]["operation"] == "max"
            and steps[1]["operation"] == "argmax"
            and "target_metric" in steps[1]
        ):
            return {
                "max_value": results[0],
                steps[1]["target_metric"]:
                    results[1][0].get(steps[1]["target_metric"])
                    if results[1] else None
            }

        # Default pipeline behavior
        return {f"step_{i+1}": r for i, r in enumerate(results)}

    # =================================================
    # MAIN EXECUTION
    # =================================================
    def run(self, plan):

        df = self.df.copy()
        df = self._apply_filters(df, plan.get("filters"))

        operation = plan["operation"]

        # SELECT
        if operation == "select":
            return df.to_dict("records")

        # LIST UNIQUE
        if operation == "list_unique":
            col = self._real_col(plan["metric"])
            values = sorted(df[col].dropna().unique())
            return [{plan["metric"]: v} for v in values]

        # COUNT UNIQUE
        if operation == "count_unique":
            col = self._real_col(plan["metric"])
            return int(df[col].nunique())

        # AGGREGATIONS
        if operation in ["sum", "avg", "min", "max", "count"]:
            col = self._real_col(plan["metric"])

            if operation == "sum":
                return float(df[col].sum())
            if operation == "avg":
                return float(df[col].mean())
            if operation == "min":
                return float(df[col].min())
            if operation == "max":
                return float(df[col].max())
            if operation == "count":
                return int(df[col].count())

        # GROUP BY AGGREGATION
        if plan.get("groupby") and operation in ["sum", "avg", "min", "max", "count"]:
            group_col = self._real_col(plan["groupby"])
            metric_col = self._real_col(plan["metric"])

            grouped = df.groupby(group_col)[metric_col]

            if operation == "sum":
                result = grouped.sum()
            elif operation == "avg":
                result = grouped.mean()
            elif operation == "min":
                result = grouped.min()
            elif operation == "max":
                result = grouped.max()
            elif operation == "count":
                result = grouped.count()

            result = result.sort_values(
                ascending=(plan.get("sort") != "desc")
            )

            if plan.get("limit"):
                result = result.head(plan["limit"])

            return result.to_dict()

        # ARGMAX / ARGMIN
        if operation in ["argmax", "argmin"]:
            col = self._real_col(plan["metric"])

            if df.empty:
                return []

            idx = df[col].idxmax() if operation == "argmax" else df[col].idxmin()
            return [df.loc[idx].to_dict()]

        return None
