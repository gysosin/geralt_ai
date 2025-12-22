def create_index(collection):
    index_params = {
        "metric_type": "L2",  # Or "COSINE" for cosine similarity
        "index_type": "IVF_FLAT",  
        "params": {"nlist": 128},  
    }
    # print(f"Creating index for {collection.name}...")
    collection.create_index(field_name="embedding", index_params=index_params)
    # print(f"Index created for {collection.name}")
