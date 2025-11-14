from sentence_transformers import SentenceTransformer, util

model = SentenceTransformer('all-MiniLM-L6-v2')

sentences = [
    "I need a refund for my order",
    "How do I reset my password?",
    "What is the weather in New York?",
    "Please cancel my subscription",
    "I want to return my shoes"
]

embeddings = model.encode(sentences, convert_to_tensor=True)

print("Embedding Shape:", embeddings.shape)
print("Refund vs Return:", util.cos_sim(embeddings[0], embeddings[4]).item())
print("Refund vs Password:", util.cos_sim(embeddings[0], embeddings[1]).item())
print("Password vs Cancel:", util.cos_sim(embeddings[1], embeddings[3]).item())
