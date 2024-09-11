## 🚀 Git Tagging Made Easy with `bg-tag` 🏷️

This handy script streamlines the process of creating and managing Git tags, making your version control workflow a breeze! 🌬️

## Get Started 💪

1. **Prerequisites:** Node.js and npm (or yarn)
2. **Installation:**

   **Install the package globally for easy access from anywhere in your system:**

   ```bash
   npm install -g bg-tag
   ```

   or, if you use yarn:

   ```bash
   yarn global add bg-tag
   ```

## How to Use 🛠️

Just run:

```bash
npx bg-tag [--handly]
```

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
npx bg-tag --handly
```

**Automatic version:**

```bash
npx bg-tag
```

**Important:** Make sure you're in a Git repository!

Let me know if you have any questions or need further assistance! 🙋‍♀️ 
