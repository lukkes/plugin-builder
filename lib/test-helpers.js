import dotenv from "dotenv"
import { jest } from "@jest/globals"
import pluginObject from "./plugin"
import {_sectionRange, stripMarkdownFormatting} from "./test-helpers-markdown.js";

dotenv.config();

export const mockPrompter = (values) => ({
  queue: values,
  index: 0,
  getNext: function () {
    if (this.index >= this.queue.length) return undefined;
    let result = this.queue[this.index];
    this.index = this.index + 1;
    return result;
  }
});

/*
 * How to use: create a mockPrompter object and fill it with values as would be returned
 * from an app.prompt() call.
 *
 * Every value from "values" is a separate `prompt()` result from the user.
 *
 * Example:
 * import {mockApp, mockPrompter} from "../lib/test-helpers.js";
 * beforeEach( () => {
 *   // Make sure to create an appropriate mock prompter before each test
 *   // This test will call app.prompt() at some point, exactly 4 times
 *   let _mockPrompter = mockPrompter([ // This mock prompter simulates 4 user prompt inputs
 *      {index: 0},  // Return the first element from an "options" type prompt
 *      "This is a string", // Return this string from a "string" type prompt
 *      [1, 2, 3], // Return these multiple values from a prompt that asks for multiple values
 *      noteHandle,  // Return this note handle for a prompt that asks for a note, etc.
 *   ]);
 *   let app = mockApp(mockPrompter)
 *   }
 */
async function promptFunction(app, ...params) {
  console.error(`Prompt was called: ${params.map(e => JSON.stringify(e))}`);
  let next = app._mockPrompter.getNext();
  if (typeof next === "object" && next.index !== undefined) {
    return params[1].inputs[0].options[next.index].value;
  } else {
    return next;
  }
}

// --------------------------------------------------------------------------------------
export const mockPlugin = () => {
  const plugin = { ... pluginObject };
  if (plugin.insertText) {
    Object.entries(plugin.insertText).forEach(([ key]) => {
      plugin.insertText[key] = plugin.insertText[key].run?.bind(plugin) || plugin.insertText[key].bind(plugin); // .insertText
    });
  }
  if (plugin.noteOption) {
    Object.entries(plugin.noteOption).forEach(([ key]) => {
      plugin.noteOption[key] = plugin.noteOption[key].run?.bind(plugin) || plugin.noteOption[key].bind(plugin);
    });
  }

  if (plugin.replaceText) {
    Object.entries(plugin.replaceText).forEach(([ key]) => {
      plugin.replaceText[key] = plugin.replaceText[key].run?.bind(plugin) || plugin.replaceText[key].bind(plugin);
    });
  }

  return plugin;
}

// --------------------------------------------------------------------------------------
export const mockApp = (seedNote, mockPrompter) => {
  const app = {};
  app.alert = text => console.error("Alert was called", text);
  app.context = {};
  app.context.noteUUID = "abc123";
  app.context.replaceSelection = async (content) => {
    return insertNoteContent.bind(app)(
        await app.findNote({uuid: app.context.noteUUID}),
        content
    );
  };
  app.context.taskUUID = undefined;
  app.createNote = jest.fn();
  app.getNoteContent = jest.fn();
  app.getNoteSections = getNoteSections;
  app.prompt = (...params) => {
    return promptFunction(app, params);
  }
  app.navigate = jest.fn();
  app.notes = {};
  app.notes.find = jest.fn().mockResolvedValue(null);
  app.notes.filter = jest.fn().mockResolvedValue([]);
  app.notes.create= jest.fn();
  app.filterNotes = jest.fn().mockResolvedValue([]);
  app.attachNoteMedia = jest.fn();
  app.openSidebarEmbed = jest.fn();
  app.settings = {};
  app._noteRegistry = {};
  app._taskRegistry = {};

  if (seedNote) {
    app._noteRegistry[seedNote.uuid] = seedNote;
  }

  if (mockPrompter) {
    app._mockPrompter = mockPrompter;
  }

  const noteFunction = jest.fn();
  noteFunction.mockImplementation(noteHandle => {
    if (typeof noteHandle === "string") {
      return app._noteRegistry[noteHandle];
    } else if (typeof noteHandle === "number") {
      return null;
    } else if (noteHandle.uuid) {
      return app._noteRegistry[noteHandle.uuid];
    } else if (noteHandle.name && noteHandle.tags) {
      return Object.values(app._noteRegistry).filter(
          note => note.name === noteHandle.name && noteHandle.tags.every(tag => note.tags.includes(tag))
      )[0];
    }

  });
  const getContent = jest.fn();
  getContent.mockImplementation(noteHandle => {
    return app._noteRegistry[noteHandle.uuid].body;
  });

  app.findNote = noteFunction;
  app.notes.find = noteFunction;
  app.getNoteContent = getContent;
  const mockFilterNotes = jest.fn();
  mockFilterNotes.mockImplementation(params => {
    const tag = params.tag;
    return Object.values(app._noteRegistry).filter(note => {
      for (const noteTag of note.tags) {
        if (noteTag.includes(tag)) return true;
      }
      return false;
    });
  })
  app.notes.filter = mockFilterNotes;
  app.filterNotes = mockFilterNotes;

  const mockCreateNote = jest.fn();
  mockCreateNote.mockImplementation(async (title, tags, content, uuid) => {
    if (!uuid) uuid = String(Object.keys(app._noteRegistry).length + 1);
    const newNote = mockNote(content, title, uuid, tags);
    app._noteRegistry[newNote.uuid] = newNote;
    return uuid;
  })
  app.createNote = mockCreateNote;
  app.notes.create = mockCreateNote;

  const mockCreateTask = jest.fn();
  mockCreateTask.mockImplementation(async (content, uuid, noteUUID, important, urgent) => {
    app._taskRegistry[uuid] = mockTask(content, uuid, noteUUID, important, urgent);
    return uuid;
  })
  app.createTask = mockCreateTask;

  app.replaceNoteContent = async (note, newContent, sectionObject = null) => {
    note = app.findNote(note) || note;
    _replaceNoteContent(note, newContent, sectionObject);
  };

  return app;
}

async function getNoteSections(note) {
  const headingMatches = note.body.matchAll(/^#+\s+([^\n]+)/gm);
  let arrayMatches = [];
  let headingCounts = {};

  for (const match of headingMatches) {
    let headingText = stripMarkdownFormatting(match[1]);
    let anchor = match[1].replace(/\s/g, "_");
    let level = match[0].match(/^#+/)[0].length;

    // Count occurrences of each heading
    if (!headingCounts[headingText]) {
      headingCounts[headingText] = 0;
    }
    headingCounts[headingText] += 1;

    let headingObj = {
      heading: {
        anchor: anchor,
        level: level,
        text: headingText,
      },
    };

    // Add index if this is not the first occurrence
    if (headingCounts[headingText] > 1) {
      headingObj.index = headingCounts[headingText] - 1;
    }

    arrayMatches.push(headingObj);
  }

  return arrayMatches;
}

async function insertNoteContent(note, newContent, options) {
  if (!note.body && note.uuid) {
    // When we call this method with a {uuid: UUID} parameter
    note = this._noteRegistry[note.uuid];
  }
  if (options && options.atEnd) {
    note.body += newContent;
  } else {
    note.body = `${ note.body }\n${ newContent }`;
  }
  note.lastUpdated = new Date();
}

// --------------------------------------------------------------------------------------
export const mockTask = (content, uuid, noteUUID, important=false, urgent=false) => {
  const task = {};
  task.content = content || "";
  task.score = 0;
  task.noteUUID = noteUUID
  task.uuid = uuid;
  task.important = important;
  task.urgent = urgent;

  return task;
}

// --------------------------------------------------------------------------------------
export const mockNote = (content, name, uuid, tags) => {
  const note = {};
  note.body = content || "";
  note.name = name;
  note.uuid = uuid;
  note.tags = tags;
  note.content = () => note.body;
  note.lastUpdated = new Date();

  // --------------------------------------------------------------------------------------
  note.insertContent = async (newContent, options = {}) => {
    return await insertNoteContent(note, newContent, options)
  }

  // --------------------------------------------------------------------------------------
  note.replaceContent = async (newContent, sectionObject = null) => {
    _replaceNoteContent(note, newContent, sectionObject);
    note.lastUpdated = new Date();
  };

  // --------------------------------------------------------------------------------------
  note.sections = async () => {
    return getNoteSections(note);
  }
  return note;
}

function _replaceNoteContent(note, newContent, sectionObject = null) {
  if (sectionObject) {
    const sectionHeadingText = sectionObject.section.heading.text;

    const {startIndex, endIndex} = _sectionRange(note.body, sectionHeadingText, sectionObject.section.index);

    if (Number.isInteger(startIndex)) {
      note.body = `${note.body.slice(0, startIndex)}${newContent.trim()}\n${note.body.slice(endIndex)}`;
    } else {
      throw new Error(`Could not find section ${ sectionObject.section.heading.text } in note ${ note.name }`);
    }
  } else {
    note.body = newContent;
  }
  note.lastUpdated = new Date();
}
