import pandas as pd

# scikit-learn imports
from sklearn.model_selection   import StratifiedKFold, GridSearchCV, train_test_split
from sklearn.pipeline          import Pipeline
from sklearn.impute            import SimpleImputer
from sklearn.preprocessing     import StandardScaler
from sklearn.metrics           import roc_curve, roc_auc_score
import joblib
import matplotlib.pyplot as plt

# XGBoost import
from xgboost import XGBClassifier


# 1) Load your oversampled dataset (with ADHD_label and all features)
df = pd.read_excel('C:/Users/nehan/TerraHacks/exp_oversampled.xlsx')

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

# 3) Train/test split
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=42
)

# 4) Build the pipeline
pipe = Pipeline([
    ('imputer', SimpleImputer(strategy='median')),
    ('scaler',  StandardScaler()),
    ('xgb', XGBClassifier(
        use_label_encoder=False,
        eval_metric='logloss',
        random_state=42
    ))
])

# 5) Hyperparameter grid
param_grid = {
    'xgb__n_estimators':    [50, 100, 200],
    'xgb__max_depth':       [3, 5, 7],
    'xgb__learning_rate':   [0.01, 0.1, 0.2],
    'xgb__subsample':       [0.6, 0.8, 1.0],
    'xgb__colsample_bytree':[0.6, 0.8, 1.0]
}

# 6) Nested GridSearchCV for AUC
cv_outer = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
grid = GridSearchCV(
    estimator=pipe,
    param_grid=param_grid,
    cv=cv_outer,
    scoring='roc_auc',
    n_jobs=-1,
    verbose=2
)
grid.fit(X_train, y_train)

print("Best CV AUC (XGB):", grid.best_score_)
print("Best params:", grid.best_params_)

# 7) Save the best model
joblib.dump(grid.best_estimator_, 'C:/Users/nehan/TerraHacks/xgb_pipeline.pkl')

# 8) Quick ROC on held-out test set
best_xgb = grid.best_estimator_
y_prob = best_xgb.predict_proba(X_test)[:,1]
auc   = roc_auc_score(y_test, y_prob)
fpr, tpr, _ = roc_curve(y_test, y_prob)

plt.figure()
plt.plot(fpr, tpr, label=f"XGB (AUC = {auc:.2f})")
plt.plot([0,1],[0,1], 'k--', label="Chance")
plt.xlabel("False Positive Rate")
plt.ylabel("True Positive Rate")
plt.title("Test-set ROC – XGBoost")
plt.legend(loc="lower right")
plt.tight_layout()
plt.show()
