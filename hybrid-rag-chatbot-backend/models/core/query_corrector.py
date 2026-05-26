import re
from difflib import get_close_matches


class QueryCorrector:
    """
    ChatGPT-style spelling correction:
    - Corrects entire sentence
    - Uses dataset vocabulary + general English words
    - No hardcoded aliases
    """

    def __init__(self, df):
        self.vocab = set()

        # Build vocabulary from dataset values
        for col in df.columns:
            values = df[col].dropna().astype(str).str.lower()
            for v in values:
                for token in re.findall(r"[a-z]+", v):
                    if len(token) > 2:
                        self.vocab.add(token)

        # Add domain words (lightweight, generic)
        self.vocab.update([
            "which", "what", "who", "how", "many", "most", "least",
            "supplied", "supply", "supplies",
            "material", "materials", "product", "products",
            "vendor", "vendors", "supplier", "suppliers",
            "plant", "plants", "region", "category",
            "cost", "price", "highest", "lowest", "maximum", "minimum",
            "by", "from", "for"
        ])

    def correct(self, query: str) -> str:
        query = query.lower()
        tokens = re.findall(r"[a-z]+|[^a-z\s]", query)

        corrected = []
        for token in tokens:
            if token.isalpha() and token not in self.vocab and len(token) > 2:
                match = get_close_matches(token, self.vocab, n=1, cutoff=0.75)
                corrected.append(match[0] if match else token)
            else:
                corrected.append(token)

        return "".join(
            t if not t.isalpha() else " " + t for t in corrected
        ).strip()
