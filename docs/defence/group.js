// Group details shared by the report and the slides.
//
// group.json   — faculty, supervisor, defenceDate (leave "" until confirmed; the documents print a blank), repoUrl
// members.json — members per project: { "aacnras": [{ name, matric, department, linkedin }], ... }
//                The split was drawn at random; edit the file to move people between projects.
//                It holds personal details, so git ignores it; copy members.example.json to start one.
const group = require("./group.json");
const fs = require("fs");
const path = require("path");
const membersFile = path.join(__dirname, "members.json");
const projects = fs.existsSync(membersFile) ? require(membersFile) : require("./members.example.json");

const project = process.env.PROJECT ?? "aacnras";
const members = projects[project] ?? [];

module.exports = {
  ...group,
  project,
  members,
  hasMembers: members.length > 0,
};
