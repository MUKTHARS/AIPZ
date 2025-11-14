import pandas as pd
from sklearn.preprocessing import StandardScaler

# Load dataset
train = pd.read_csv("/home/student/Desktop/PS/backend/data/datasets/ml/level_1/M_001/train.csv")

# 1. Handle missing values safely (avoid inplace=True)
for col in train.columns:
    if train[col].dtype == 'object':
        mode_val = train[col].mode()[0]
        train[col] = train[col].fillna(mode_val)
    else:
        mean_val = train[col].mean()
        train[col] = train[col].fillna(mean_val)

# 2. One-hot encode categorical features
categorical_cols = [
    'mainroad', 'guestroom', 'basement', 'hotwaterheating',
    'airconditioning', 'prefarea', 'furnishingstatus'
]
train = pd.get_dummies(train, columns=categorical_cols, drop_first=True)

# 3. Handle outliers with IQR
numeric_cols = ['price', 'area']
for col in numeric_cols:
    Q1 = train[col].quantile(0.25)
    Q3 = train[col].quantile(0.75)
    IQR = Q3 - Q1
    lower = Q1 - 1.5 * IQR
    upper = Q3 + 1.5 * IQR
    train = train[(train[col] >= lower) & (train[col] <= upper)]

# 4. Feature scaling
scaler = StandardScaler()
train[numeric_cols] = scaler.fit_transform(train[numeric_cols])

# ✅ Final confirmation
train.info()


# ==========================================
# Part 2: Model Training and Evaluation
# ==========================================

from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
from sklearn.metrics import r2_score

# Separate features and target
X = train.drop(columns=['price'])
y = train['price']

# Train-validation split (80%-20%)
X_train, X_val, y_train, y_val = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# ✅ Initialize Linear Regression (no normalize argument)
model = LinearRegression(fit_intercept=True)

# Train the model
model.fit(X_train, y_train)
# Predict on validation data
y_pred = model.predict(X_val)

# Compute R² score
r2 = r2_score(y_val, y_pred)

# Print result in required format
print(f"R-squared Score: {r2:.4f}")


import pandas as pd

# Load the already preprocessed test dataset
test_df = pd.read_csv('/home/student/Desktop/PS/backend/data/datasets/ml/level_1/M_001/test_preprocessed.csv')
# Apply same encoding


# Predict using the already trained model
y_pred_test = model.predict(test_df)

# Create submission file
submission = pd.DataFrame({
    'Id': range(1, len(y_pred_test) + 1),
    'SalePrice': y_pred_test
})

submission.to_csv('submission.csv', index=False)
