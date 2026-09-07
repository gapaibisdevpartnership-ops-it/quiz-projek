# Question Types

## Type Registry

Use stable values:

```ts
type QuestionType =
  | "single_choice"
  | "multiple_choice"
  | "true_false"
  | "essay";
```

Do not branch based on quiz title or database row IDs.

## Renderer Pattern

Recommended:

```text
QuestionRenderer
  |
  +-- SingleChoiceQuestion
  +-- MultipleChoiceQuestion
  +-- TrueFalseQuestion
  +-- EssayQuestion
```

## Question Content Model

A question may include:

- text;
- image;
- both.

At least meaningful text or an image must be present.

## Single Choice

Admin:

- enters question;
- optionally uploads image;
- adds answer options;
- optionally adds images to options;
- marks exactly one option correct.

Sales:

- selects one option.

Scoring:

- full points if correct;
- zero if incorrect.

## Multiple Choice

Admin:

- creates 2 or more options;
- marks one or more correct options.

Sales:

- selects zero or more options.

V1 scoring:

Selected set must exactly equal correct set.

## True / False

Admin:

- provides question;
- selects correct boolean answer.

Sales:

- selects True or False.

## Essay

Admin configures:

- question;
- optional image;
- maximum points;
- optional minimum characters;
- optional maximum characters;
- optional sample answer;
- optional grading notes.

Sales:

- enters free text.

Admin/Trainer:

- assigns a score;
- may provide feedback.

## Dynamic Answer Options

Answer options may contain:

- text only;
- image only;
- text + image.

Validation:

At least one of `answer_text` or `image_url` must exist.

Recommended UI:

```text
Answer Options

[drag]
Text: [..............]
Image: [Upload]
Correct: [ ]
Remove

[ + Add Answer Option ]
```

No business rule should assume exactly four options.

## Future Extensibility

Possible future types:

- short_answer
- image_choice
- ordering
- matching
- rating_scale
- file_upload
- audio
- video
- case_study
- roleplay

Adding a future type should primarily require:

- type registration;
- editor component;
- renderer component;
- validation rules;
- scoring implementation.
