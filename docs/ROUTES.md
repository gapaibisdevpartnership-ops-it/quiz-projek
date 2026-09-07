# Application Routes

## Public / Authentication

```text
/login
/forgot-password
/reset-password
```

## Sales

```text
/dashboard
/quizzes
/quizzes/:quizId
/quizzes/:quizId/start
/quizzes/:quizId/attempt/:attemptId
/quizzes/:quizId/result/:attemptId
/history
/leaderboard
/profile
```

## Admin

```text
/admin
/admin/quizzes
/admin/quizzes/new
/admin/quizzes/:quizId
/admin/quizzes/:quizId/edit
/admin/quizzes/:quizId/questions

/admin/questions
/admin/questions/new
/admin/questions/:questionId/edit

/admin/users
/admin/users/:userId

/admin/teams

/admin/results
/admin/results/:attemptId

/admin/grading
/admin/analytics
/admin/settings
```

## Route Protection

Unauthenticated users:

- redirected to login from protected routes.

Sales users:

- denied access to `/admin/*`.

Admin/Trainer:

- access only authorized management sections.

Route guards are UX protections only. Database/server authorization remains mandatory.
