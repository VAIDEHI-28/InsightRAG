def build_schema_docs(schema):
    docs = []
    for semantic, real in schema.items():
        docs.append(f"{semantic} refers to the column '{real}' in the dataset.")
    return docs
