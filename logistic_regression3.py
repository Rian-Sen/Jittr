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

# ─── 1) LOAD & MERGE MOUSE + KEYPRESS SUMMARIES ───────────────────────────────

# Exp1
m1 = pd.read_csv('C:/Users/nehan/TerraHacks/exp1_mouse.csv')
k1 = pd.read_csv('C:/Users/nehan/TerraHacks/exp1_key.csv')
exp1 = m1.join(k1)                  # assumes same row order = same participants
exp1['experiment'] = 'preset_SSD'

# Exp2
m2 = pd.read_csv('C:/Users/nehan/TerraHacks/exp2_mouse.csv')
k2 = pd.read_csv('C:/Users/nehan/TerraHacks/exp2_key.csv')
exp2 = m2.join(k2)
exp2['experiment'] = 'staircase_SSD'

# Combine
df = pd.concat([exp1, exp2], ignore_index=True)

# ─── 2) TRUE LABEL (from participants.tsv) ────────────────────────────────────
# If you have a real 'ADHD' column in participants.tsv, merge that earlier.
# Otherwise, keep using the H‐quantile cutoff:
df['ADHD_label'] = (df['H'] >= df['H'].quantile(0.7)).astype(int)

# ─── 3) DEFINE MOUSE & KEYPRESS FEATURE LISTS ────────────────────────────────

mouse_feats = [
    'vel_max_nogo10coh','acc_max_nogo10coh','total_dist_nogo10coh',
    'vel_max_nogo50coh','acc_max_nogo50coh','total_dist_nogo50coh',
    'vel_max_nogo80coh','acc_max_nogo80coh','total_dist_nogo80coh',
    'ssrt_integ','IN','vol','go_acc','meanmt'
]

key_feats = [
    'meanRT_go', 'sdRT_go',
    'meanRT_stop', 'sdRT_nogo',
    'dda', 'stop_accuracy',
    'ssrt_integ', 'ssrt0.1', 'ssrt0.5', 'ssrt0.8'
]

# Make sure all those columns exist
all_feats = [f for f in mouse_feats + key_feats if f in df.columns]
missing = set(mouse_feats+key_feats) - set(all_feats)
if missing:
    print("Warning: missing features", missing)

# ─── 4) BUILD X & y ────────────────────────────────────────────────────────────

X = df[all_feats + ['experiment']].copy()
X = pd.get_dummies(X, columns=['experiment'], drop_first=True)
y = df['ADHD_label']

# ─── 5) NESTED CV PIPELINE (Impute → Scale → RFECV → LogisticRegression) ────

cv_outer = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

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

param_grid = {
    'logreg__C': [0.01,0.05,0.1,0.5,1,5,10]
}

grid = GridSearchCV(
    estimator=pipe,
    param_grid=param_grid,
    cv=cv_outer,
    scoring='roc_auc',
    n_jobs=-1,
    verbose=2
)

# ─── 6) FIT & SAVE ─────────────────────────────────────────────────────────────

grid.fit(X, y)
print("Best CV AUC:", grid.best_score_)
print("Best C:", grid.best_params_['logreg__C'])

best_pipe = grid.best_estimator_
joblib.dump(best_pipe, 'C:/Users/nehan/TerraHacks/logreg_pipeline.pkl')
print("✅ Saved new pipeline with mouse+keypress features.")

# ─── 7) PLOT ROC ON FULL (oversampled) DATA ────────────────────────────────────

y_prob = best_pipe.predict_proba(X)[:,1]
fpr, tpr, _ = roc_curve(y, y_prob)
auc = roc_auc_score(y, y_prob)

plt.figure()
plt.plot(fpr, tpr, label=f"LogReg (AUC = {auc:.2f})")
plt.plot([0,1],[0,1],'k--', label="Chance")
plt.xlabel("False Positive Rate")
plt.ylabel("True Positive Rate")
plt.title("ROC – Mouse + Keypress Logistic Regression")
plt.legend(loc="lower right")
plt.tight_layout()
plt.show()
