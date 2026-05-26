from difflib import get_close_matches


class EntityResolver:
    def __init__(self, df, schema):
        self.schema = schema
        self.entity_values = {}

        for semantic, col in schema.items():
            values = df[col].dropna().astype(str).unique()
            self.entity_values[semantic] = set(v.lower() for v in values)

    def resolve(self, question: str) -> str:
        words = question.split()
        resolved_words = []

        for w in words:
            replaced = False
            for semantic, values in self.entity_values.items():
                match = get_close_matches(w.lower(), values, n=1, cutoff=0.85)
                if match:
                    resolved_words.append(match[0])
                    replaced = True
                    break
            if not replaced:
                resolved_words.append(w)

        return " ".join(resolved_words)
