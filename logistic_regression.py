import pandas as pd
import joblib
import matplotlib.pyplot as plt

from sklearn.model_selection   import StratifiedKFold, GridSearchCV, train_test_split
from sklearn.pipeline          import Pipeline
from sklearn.impute            import SimpleImputer
from sklearn.preprocessing     import StandardScaler
from sklearn.feature_selection import RFECV
from sklearn.linear_model      import LogisticRegression
from sklearn.metrics           import roc_curve, roc_auc_score, classification_report

# 1) Load & prepare data (same as before)
exp1 = pd.read_csv('C:/Users/nehan/TerraHacks/exp1_mouse.csv')
exp2 = pd.read_csv('C:/Users/nehan/TerraHacks/exp2_mouse.csv')
exp1['experiment'] = 'preset_SSD'
exp2['experiment'] = 'staircase_SSD'
df = pd.concat([exp1, exp2], ignore_index=True)
threshold = df['H'].quantile(0.8)
df['ADHD_label'] = (df['H'] >= threshold).astype(int)

features = [
    'vel_max_nogo10coh','acc_max_nogo10coh','total_dist_nogo10coh',
    'vel_max_nogo50coh','acc_max_nogo50coh','total_dist_nogo50coh',
    'vel_max_nogo80coh','acc_max_nogo80coh','total_dist_nogo80coh',
    'ssrt_integ','IN','vol','go_acc','meanmt'
]
X = df[features + ['experiment']].copy()
X = pd.get_dummies(X, columns=['experiment'], drop_first=True)
y = df['ADHD_label']

# 2) Outer CV splitter
cv_outer = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

# 3) Pipeline: Impute → Scale → RFECV (linear) → Logistic Regression
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
                    solver='liblinear',    # good for small data
                    max_iter=1000,
                    random_state=42
               ))
])

# 4) Hyperparameter grid (only C for logistic)
param_grid = {
    'logreg__C': [0.01, 0.05, 0.1,0.5, 1, 5, 10, 20, 100]
}

# 5) Nested Grid Search
grid = GridSearchCV(
    estimator=pipe,
    param_grid=param_grid,
    cv=cv_outer,
    scoring='roc_auc',
    n_jobs=-1,
    verbose=2
)

# 6) Fit & report
grid.fit(X, y)
print("Best CV AUC (LogReg):", grid.best_score_)
print("Best C:", grid.best_params_['logreg__C'])

# 7) Save best estimator
best_lr = grid.best_estimator_
joblib.dump(best_lr, 'C:/Users/nehan/TerraHacks/logreg_pipeline.pkl')

# 8) Quick ROC on full data for visualization
y_prob = best_lr.predict_proba(X)[:,1]
fpr, tpr, _ = roc_curve(y, y_prob)
auc = roc_auc_score(y, y_prob)

plt.figure()
plt.plot(fpr, tpr, label=f"LogReg (AUC = {auc:.2f})")
plt.plot([0,1], [0,1], 'k--', label="Chance")
plt.xlabel("False Positive Rate")
plt.ylabel("True Positive Rate")
plt.title("ROC Curve – Logistic Regression")
plt.legend(loc="lower right")
plt.show()
