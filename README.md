## 🚀 Git Tagging Made Easy 🏷️

This handy script streamlines the process of creating and managing Git tags, making your version control workflow a breeze! 🌬️

## Get Started 💪

1. **Prerequisites:** Node.js and npm (or yarn)
2. **Installation:**
    - Clone/copy the script into your project.
    - Run `npm install` (or `yarn install`) in your project's terminal.

## How to Use 🛠️

Just run:

```bash
node your-script-file.js [--handly]
```

- Replace `your-script-file.js` with the script's actual filename.
- Add `--handly` if you want to type the new version yourself. Otherwise, we'll generate it for you! ✨

## What it Does 🤖

- **Updates your project** (if needed).
- **Finds the latest tag** in your repo.
- **Asks for the new version** (or generates it automatically).
- **Lets you pick the branch** to tag from a list.
- **Confirms** everything before making changes.
- **Creates the tag** and pushes it to your remote repo.
- **Gives you the pipeline URL** for the new tag (if available).
- **Handles errors** gracefully, so you don't have to worry! 😊

## Example 🎉

**Manual version:**

```bash
node tag-script.js --handly
```

**Automatic version:**

```bash
node tag-script.js
```

**Important:** Make sure you're in a Git repository!

Let me know if you have any questions or need further assistance! 🙋‍♀️ 
