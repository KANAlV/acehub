# Acehub

A web-based faculty scheduling system that generates class schedules and exports them to **Excel format**.
This project uses **React**, **TailwindCSS**, and **ExcelJS** to create an interactive interface and automatically generate formatted schedule spreadsheets.

---

# Technologies Used

This project was built using the following tools and libraries:

* **Flowbite** – UI component library for TailwindCSS
* **Flowbite React** – React components built on Flowbite
* **Tailwind CSS** – Utility-first CSS framework
* **ExcelJS** – Library used to generate and export Excel schedule files
* **FileSaver.js** – Library used to trigger the browser download of generated files
* **React Icons** – Icon library for React
* **Node Package Manager (npm)** – version **10.8.2**

---

# Prerequisites

Before running the project, make sure you have:

* **Node.js installed**
* **npm version 10.8.2 or newer**

Check your npm version:

```bash
npm -v
```

---

# Installation

Clone the repository:

```bash
git clone https://github.com/yourusername/acehub.git
```

Go into the project directory:

```bash
cd acehub
```

Install project dependencies:

```bash
npm install
```

---

# Install Required Libraries

If installing manually, install the required packages using:

### TailwindCSS

```bash
npm install -D tailwindcss postcss autoprefixer
```

and create the config in the project root if missing: 
### tailwind.config.js

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/flowbite-react/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require("flowbite/plugin")
  ],
}
```

---

### Flowbite & Flowbite React

```bash
npm install flowbite flowbite-react
```

---

### ExcelJS & FileSaver.js

```bash
npm install exceljs file-saver
```

---

### React Icons

```bash
npm install react-icons
```

---

### Postgres

```bash
npm install postgres
```
---

### Azure

```bash
npm install @azure/msal-react @azure/msal-browser
```

---

# Running the Project

Start the development server:

```bash
npm run dev
```

The application will be available at:

```
http://localhost:3000
```

---

# Features

* Automatic **faculty scheduling**
* **Conflict detection**
* **Excel schedule export**
* **Responsive UI**
* Organized schedules by **program and section**

---

# Project Structure

```
/app
/components
/lib
/public
```

---

# License

This project is for **academic and educational purposes**.
