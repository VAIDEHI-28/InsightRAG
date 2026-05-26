class Retriever:
    """
    Retriever layer for Hybrid RAG.

    Responsibilities:
    1. Embed user query
    2. Search vector store (Milvus)
    3. Return relevant texts only
    """

    def __init__(self, vectorstore, embed_function):
        self.vectorstore = vectorstore
        self.embed_function = embed_function

    # =================================================
    # Retrieve Top-K Relevant Chunks
    # =================================================
    def retrieve(self, query: str, k: int = 5):
        """
        Steps:
        1. Convert query → embedding
        2. Search Milvus using cosine similarity
        3. Return only text chunks
        """

        # Step 1 — Embed Query
        query_embedding = self.embed_function(query)

        # Step 2 — Search Milvus
        results = self.vectorstore.search(query_embedding, k)

        if not results:
            return []

        # Step 3 — Extract only text for LLM context
        return [r["text"] for r in results]
