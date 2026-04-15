import kagglehub
import os

print("Downloading dataset...")
path = kagglehub.dataset_download("budnyak/wine-rating-and-price")
print("DOWNLOAD_PATH_START", path, "DOWNLOAD_PATH_END")
