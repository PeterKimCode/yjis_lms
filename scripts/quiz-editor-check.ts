import assert from "node:assert/strict"
import { test } from "node:test"
import { validateEditorQuestions } from "../src/modules/quizzes/editor-validation"
const choice = {
  key: "q1",
  type: "MULTIPLE_CHOICE",
  prompt: "Choose A",
  points: 2,
  explanation: "",
  acceptedAnswers: "",
  options: [
    { text: "A", isCorrect: true },
    { text: "B", isCorrect: false },
    { text: "", isCorrect: false }
  ]
}
test("empty draft allowed; empty publication refused", () => {
  assert.equal(validateEditorQuestions([], false).ok, true)
  assert.equal(validateEditorQuestions([], true).ok, false)
})
test("one nonempty correct choice required", () => {
  assert.equal(validateEditorQuestions([choice], true).ok, true)
  for (const options of [
    [{ text: "A", isCorrect: true }],
    [
      { text: "A", isCorrect: true },
      { text: "B", isCorrect: true }
    ],
    [
      { text: "A", isCorrect: false },
      { text: "B", isCorrect: false }
    ],
    [
      { text: "A", isCorrect: false },
      { text: "B", isCorrect: false },
      { text: "", isCorrect: true }
    ]
  ])
    assert.equal(
      validateEditorQuestions([{ ...choice, options }], true).ok,
      false
    )
})
test("invalid question returns its index for inline errors", () => {
  const result = validateEditorQuestions([{ ...choice, prompt: "" }], false)
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors["0"])
})
test("existing question and option IDs retained", () => {
  const result = validateEditorQuestions(
    [
      {
        ...choice,
        id: "question-id",
        options: choice.options.map((option, i) => ({
          ...option,
          id: `option-${i}`
        }))
      }
    ],
    false
  )
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.questions[0].id, "question-id")
    assert.equal(result.questions[0].options[0].id, "option-0")
  }
})
test("legacy boolean and short answers and essay supported", () => {
  for (const [type, extra] of [
    ["TRUE_FALSE", { correctBoolean: false }],
    ["SHORT_ANSWER", { acceptedAnswers: "One\nTwo" }],
    ["ESSAY", {}]
  ] as const)
    assert.equal(
      validateEditorQuestions([{ ...choice, type, ...extra }], true).ok,
      true
    )
  assert.equal(
    validateEditorQuestions(
      [{ ...choice, type: "SHORT_ANSWER", acceptedAnswers: " " }],
      true
    ).ok,
    false
  )
})
test("duplicate IDs, excessive counts and invalid points refused", () => {
  assert.equal(validateEditorQuestions([choice, choice], false).ok, false)
  for (const points of [-1, Infinity, 1000000])
    assert.equal(
      validateEditorQuestions([{ ...choice, points }], false).ok,
      false
    )
  assert.equal(
    validateEditorQuestions(
      Array.from({ length: 201 }, (_, i) => ({ ...choice, key: String(i) })),
      false
    ).ok,
    false
  )
})
