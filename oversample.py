# oversample.py
import pandas as pd
import numpy as np

# You'll need imbalanced-learn:
# pip install imbalanced-learn

from imblearn.over_sampling import SMOTE
from sklearn.impute import SimpleImputer

# 1) Load your labeled Excel
df = pd.read_excel('C:/Users/nehan/TerraHacks/exp_merged_labeled.xlsx')

print("Original dataset shape:", df.shape)
print("Original class distribution:")
print(df['ADHD_label'].value_counts())

# 2) Define X and y
#    (Assumes 'ADHD_label' is your 0/1 target and all other columns are features)
X = df.drop(columns=['ADHD_label'])
y = df['ADHD_label']

# 3) One-hot encode any categorical column (e.g. 'experiment')
X = pd.get_dummies(X, drop_first=True)

print("Feature matrix shape before imputation:", X.shape)
print("NaN values in features:", X.isna().sum().sum())

# 4) Handle missing values with imputation
if X.isna().sum().sum() > 0:
    print("Imputing missing values...")
    imputer = SimpleImputer(strategy='median')
    X_imputed = imputer.fit_transform(X)
    X = pd.DataFrame(X_imputed, columns=X.columns, index=X.index)
    print("NaN values after imputation:", X.isna().sum().sum())
else:
    print("No missing values found!")

# 5) Apply SMOTE to balance classes
print("Applying SMOTE...")
smote = SMOTE(random_state=42)
X_res, y_res = smote.fit_resample(X, y)

print("After SMOTE - X shape:", X_res.shape)
print("After SMOTE - y shape:", y_res.shape)

# 6) Reconstruct a DataFrame with the oversampled data
df_res = pd.DataFrame(X_res, columns=X.columns)
df_res['ADHD_label'] = y_res

# 7) Save to disk
df_res.to_excel('C:/Users/nehan/TerraHacks/exp_oversampled.xlsx', index=False)
print("Oversampled dataset saved to exp_oversampled.xlsx")
print("New class distribution:")
print(df_res['ADHD_label'].value_counts())
print("Final dataset shape:", df_res.shape)
