class ReferentialMemory:
    """
    Safe conversational memory.

    ONLY resolves true references like:
    them / those / that / explain this

    NEVER overrides new analytical questions.
    """

    def __init__(self):
        self.last_question = None
        self.last_plan = None
        self.last_result = None

    def store(self, question, plan, result):
        self.last_question = question
        self.last_plan = plan
        self.last_result = result

    # -----------------------------------------
    # ONLY trigger for true pronouns
    # -----------------------------------------
    def can_resolve(self, question: str):

        if not self.last_plan:
            return False

        q = question.lower().strip()

        pronouns = {
            "them", "those", "that", "these",
            "why", "explain", "details"
        }

        return any(word in q for word in pronouns)


    # -----------------------------------------
    # Safe resolution
    # -----------------------------------------
    def resolve(self, question: str):

        if not self.last_plan:
            return None

        q = question.lower().strip()
        prev = self.last_plan.copy()

        # list them
        if "them" in q or "those" in q:
            prev["limit"] = None
            prev["sort"] = None
            return prev

        # explanation
        if "why" in q or "explain" in q:
            return {"type": "explain"}

        return None
