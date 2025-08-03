import pandas as pd
import joblib
import matplotlib.pyplot as plt

from sklearn.model_selection   import StratifiedKFold, GridSearchCV
from sklearn.pipeline          import Pipeline
from sklearn.impute            import SimpleImputer
from sklearn.preprocessing     import StandardScaler
from sklearn.feature_selection import RFECV
from sklearn.linear_model      import LogisticRegression
from sklearn.metrics           import roc_curve, roc_auc_score

# 1) Load your oversampled dataset (with ADHD_label and all features)
df = pd.read_excel('/Users/shai/Desktop/TerraHacks/TerraHacks/exp_oversampled.xlsx')

print("Dataset shape:", df.shape)
print("Class distribution:", df['ADHD_label'].value_counts())

# 2) Define the same feature list you used before
features = [
    'vel_max_nogo10coh','acc_max_nogo10coh','total_dist_nogo10coh',
    'vel_max_nogo50coh','acc_max_nogo50coh','total_dist_nogo50coh',
    'vel_max_nogo80coh','acc_max_nogo80coh','total_dist_nogo80coh',
    'ssrt_integ','IN','vol','go_acc','meanmt'
]

# Check which features are available
available_features = [feat for feat in features if feat in df.columns]
print("Available features:", len(available_features), "out of", len(features))
if len(available_features) < len(features):
    print("Missing features:", [feat for feat in features if feat not in df.columns])

# 3) Build X and y
X = df[available_features + ['experiment_staircase_SSD']].copy()
X = pd.get_dummies(X, columns=['experiment_staircase_SSD'], drop_first=True)
y = df['ADHD_label']

print("Feature matrix shape:", X.shape)

# 4) Outer CV splitter
cv_outer = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

# 5) Pipeline: Impute → Scale → RFECV → LogisticRegression
pipe = Pipeline([
    ('imputer', SimpleImputer(strategy='median')),
    ('scaler',  StandardScaler()),
    ('rfecv',   RFECV(
                    estimator=LogisticRegression(penalty='l2', solver='liblinear'),
                    step=1,
                    cv=5,
                    scoring='roc_auc',
                    min_features_to_select=5
               )),
    ('logreg',  LogisticRegression(
                    penalty='l2',
                    solver='liblinear',
                    max_iter=1000,
                    random_state=42
               ))
])

# 6) Hyperparameter grid
param_grid = {
    'logreg__C': [0.01, 0.05, 0.1, 0.45, 0.48, 0.5, 0.55, 1, 5, 10, 20, 100]
}

# 7) Nested GridSearchCV
grid = GridSearchCV(
    estimator=pipe,
    param_grid=param_grid,
    cv=cv_outer,
    scoring='roc_auc',
    n_jobs=-1,
    verbose=2
)

# 8) Fit & report
print("Starting grid search...")
grid.fit(X, y)
#print("Best CV AUC (LogReg):", grid.best_score_)
print("Best C:", grid.best_params_['logreg__C'])

# 9) Save best estimator
best_lr = grid.best_estimator_
joblib.dump(best_lr, 'C:/Users/nehan/TerraHacks/logreg_pipeline.pkl')
print("✓ Saved pipeline to logreg_pipeline.pkl")

# 10) Quick ROC on the (oversampled) full data for visualization
y_prob = best_lr.predict_proba(X)[:,1]
fpr, tpr, _ = roc_curve(y, y_prob)
auc = roc_auc_score(y, y_prob)

plt.figure()
plt.plot(fpr, tpr, label=f"LogReg (AUC = {auc:.2f})")
plt.plot([0,1], [0,1], 'k--', label="Chance")
plt.xlabel("False Positive Rate")
plt.ylabel("True Positive Rate")
plt.title("ROC Curve – Logistic Regression (Oversampled)")
plt.legend(loc="lower right")
plt.tight_layout()
plt.show()
