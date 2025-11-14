import pandas as pd
import numpy as np
from sklearn.datasets import fetch_california_housing
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import os

# --- 1. Create Directories ---
# Ensure the target directories exist before saving files
output_dir = '/home/student/Desktop/PS/backend/data/datasets/ml/level_1/M_002/'
os.makedirs(output_dir, exist_ok=True)

# --- 2. Load and Prepare Base Data ---
# Fetch the California Housing dataset from scikit-learn
housing = fetch_california_housing()
df = pd.DataFrame(housing.data, columns=housing.feature_names)
df['price'] = housing.target

# Map and engineer features to match the JSON problem description
df.rename(columns={
    'MedInc': 'area',
    'HouseAge': 'stories',
    'AveRooms': 'bedrooms',
    'AveBedrms': 'bathrooms',
    'Population': 'parking',
}, inplace=True)
# Keep only the columns we need for the problem
df = df[['price', 'area', 'bedrooms', 'bathrooms', 'stories', 'parking']]

# Logically create the categorical features required by the problem
df['mainroad'] = np.where(df['area'] > df['area'].median(), 'yes', 'no')
df['guestroom'] = np.where(df['bedrooms'] > df['bedrooms'].median(), 'yes', 'no')
df['basement'] = np.where(df['stories'] > 25, 'yes', 'no')
df['hotwaterheating'] = np.where(df['bathrooms'] > df['bathrooms'].quantile(0.95), 'yes', 'no')
df['airconditioning'] = np.where(df['area'] > df['area'].quantile(0.75), 'yes', 'no')
df['prefarea'] = np.where(df['price'] > df['price'].quantile(0.75), 'yes', 'no')
df['furnishingstatus'] = pd.cut(df['price'], bins=3, labels=['unfurnished', 'semi-furnished', 'furnished'])


# --- 3. Perform All Preprocessing Steps ---
# The goal is to save the data in its FINAL, model-ready state.

# Identify numeric and categorical columns
numeric_cols = ['area', 'bedrooms', 'bathrooms', 'stories', 'parking']
categorical_cols = ['mainroad', 'guestroom', 'basement', 'hotwaterheating', 'airconditioning', 'prefarea', 'furnishingstatus']

# a) Apply Feature Scaling to numeric columns
scaler = StandardScaler()
df[numeric_cols] = scaler.fit_transform(df[numeric_cols])

# b) Apply One-Hot Encoding to categorical columns
# drop_first=True prevents multicollinearity and matches common practice
df_encoded = pd.get_dummies(df, columns=categorical_cols, drop_first=True, dtype=float)


# --- 4. Split and Save the Preprocessed Data ---
# Split the *fully processed* dataframe
train_df, test_df = train_test_split(df_encoded, test_size=0.2, random_state=42)

# Define final file paths
train_path = os.path.join(output_dir, 'train.csv')
test_path = os.path.join(output_dir, 'test.csv')
solution_path = os.path.join(output_dir, 'solution.csv')

# Save the training data (ready for model training)
train_df.to_csv(train_path, index=False)

# Save the test data (without the 'price' column)
test_features = test_df.drop(columns=['price'])
test_features.to_csv(test_path, index=False)

# Create and save the solution file for validation
solution_df = pd.DataFrame({'Id': test_df.index, 'SalePrice': test_df['price']})
solution_df.to_csv(solution_path, index=False)


# --- 5. Final Confirmation ---
print(f"Successfully generated preprocessed datasets in: {output_dir}")
print(f"Train dataset shape: {train_df.shape}")
print(f"Test dataset shape: {test_features.shape}")
print("\nColumns in the generated train.csv file:")
print(train_df.columns.tolist())
print("\nFirst 5 rows of train.csv (showing scaled and encoded data):")
print(train_df.head())