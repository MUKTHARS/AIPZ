# Part 2: Model Training and Evaluation

import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import Ridge
from sklearn.metrics import r2_score

# Load the dataset
train_path = '/home/student/Desktop/PS/backend/data/datasets/ml/level_1/M_002/train.csv'
train = pd.read_csv(train_path)

# Separate features and target
X = train.drop(columns=['price'])
y = train['price']

# Split into training and validation sets (80%-20%)
X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42)

# Train Ridge Regression model
ridge = Ridge(alpha=1.0, fit_intercept=True)
ridge.fit(X_train, y_train)

# Predict on validation data
y_pred = ridge.predict(X_val)

# Evaluate using R² score
r2 = r2_score(y_val, y_pred)

# Print R² score (rounded to 4 decimals)
print(f'R-squared Score: {r2:.4f}')







