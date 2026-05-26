from pymilvus import (
    connections,
    Collection,
    FieldSchema,
    CollectionSchema,
    DataType,
    utility
)
import uuid
from typing import List, Optional


class VectorStore:
    """
    Production-ready Milvus Vector Store
    Multi-user + Multi-chat safe
    """

    def __init__(self, dim: int):

        connections.connect(
            alias="default",
            host="127.0.0.1",
            port="19530",
        )

        self.collection_name = "rag_collection"
        self.dim = dim

        self._init_collection()

    # =====================================================
    # COLLECTION INITIALIZATION
    # =====================================================
    def _init_collection(self):

        if utility.has_collection(self.collection_name):
            existing = Collection(self.collection_name)

            existing_dim = existing.schema.fields[1].params["dim"]

            if existing_dim != self.dim:
                print("⚠️ Dimension mismatch detected.")
                print("Dropping old collection...")
                utility.drop_collection(self.collection_name)
            else:
                self.collection = existing
                self.collection.load()
                return

        fields = [
            FieldSchema(
                name="id",
                dtype=DataType.VARCHAR,
                is_primary=True,
                max_length=36
            ),
            FieldSchema(
                name="embedding",
                dtype=DataType.FLOAT_VECTOR,
                dim=self.dim
            ),
            FieldSchema(
                name="text",
                dtype=DataType.VARCHAR,
                max_length=65535
            ),
            # 🔐 NEW FIELD
            FieldSchema(
                name="user_id",
                dtype=DataType.VARCHAR,
                max_length=100
            ),
            FieldSchema(
                name="chat_id",
                dtype=DataType.VARCHAR,
                max_length=100
            ),
            FieldSchema(
                name="file_id",
                dtype=DataType.VARCHAR,
                max_length=100
            ),
            FieldSchema(
                name="doc_type",
                dtype=DataType.VARCHAR,
                max_length=100
            ),
            FieldSchema(
                name="source",
                dtype=DataType.VARCHAR,
                max_length=255
            )
        ]

        schema = CollectionSchema(
            fields,
            description="Hybrid RAG Collection (User + Chat Scoped)"
        )

        self.collection = Collection(
            self.collection_name,
            schema
        )

        index_params = {
            "metric_type": "COSINE",
            "index_type": "IVF_FLAT",
            "params": {"nlist": 128}
        }

        self.collection.create_index(
            field_name="embedding",
            index_params=index_params
        )

        self.collection.load()

    # =====================================================
    # INSERT
    # =====================================================
    def insert(
        self,
        embeddings: List[List[float]],
        texts: List[str],
        user_id: str,
        chat_id: str,
        file_id: str,
        metadata_list: Optional[List[dict]] = None
    ):

        if not embeddings:
            return

        ids = [str(uuid.uuid4()) for _ in embeddings]

        if metadata_list is None:
            metadata_list = [{} for _ in embeddings]

        doc_types = [m.get("doc_type", "unknown") for m in metadata_list]
        sources = [m.get("source", "unknown") for m in metadata_list]

        user_ids = [user_id] * len(embeddings)
        chat_ids = [chat_id] * len(embeddings)
        file_ids = [file_id] * len(embeddings)

        self.collection.insert([
            ids,
            embeddings,
            texts,
            user_ids,
            chat_ids,
            file_ids,
            doc_types,
            sources
        ])

        self.collection.flush()

    # =====================================================
    # SEARCH
    # =====================================================
    def search(self, query_embedding, user_id: str, chat_id: str, k: int = 5):

        search_params = {
            "metric_type": "COSINE",
            "params": {"nprobe": 10}
        }

        expr = f'user_id == "{user_id}" and chat_id == "{chat_id}"'

        results = self.collection.search(
            data=[query_embedding],
            anns_field="embedding",
            param=search_params,
            limit=k,
            expr=expr,
            output_fields=["text", "doc_type", "source", "file_id"]
        )

        hits = results[0]

        return [
            {
                "text": hit.entity.get("text"),
                "doc_type": hit.entity.get("doc_type"),
                "source": hit.entity.get("source"),
                "file_id": hit.entity.get("file_id"),
                "score": hit.distance
            }
            for hit in hits
        ]

    def delete_by_chat(self, user_id: str, chat_id: str):
        expr = f'user_id == "{user_id}" and chat_id == "{chat_id}"'
        self.collection.delete(expr=expr)
        self.collection.flush()

    def delete_by_file(self, user_id: str, file_id: str):
        expr = f'user_id == "{user_id}" and file_id == "{file_id}"'
        self.collection.delete(expr=expr)
        self.collection.flush()

    def clear_all(self):
        utility.drop_collection(self.collection_name)