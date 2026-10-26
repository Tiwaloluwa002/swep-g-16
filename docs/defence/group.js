// Group details shared by the report and the slides. Edit group.json, not this file.
//
// group.json fields:
//   faculty, supervisor, defenceDate — leave "" until confirmed; the documents show a blank to fill in
//   members — [{ "name": "...", "matric": "...", "department": "..." }, ...]
const group = require("./group.json");

module.exports = {
  ...group,
  hasMembers: group.members.length > 0,
};
