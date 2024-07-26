const express = require("express");
const mysql = require("mysql");
const multer = require("multer");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const cors = require("cors"); // Import cors

const app = express();
app.use(cors()); // Use cors middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "invoice_generator",
});

db.connect((err) => {
  if (err) {
    console.error("MySQL connection error:", err);
    throw err;
  }
  console.log("MySQL Connected...");
});

// Multer setup for file uploads
const upload = multer({ dest: "uploads/" });

// Routes
app.post("/clients", (req, res) => {
  const { name, email, company } = req.body;
  const sql = "INSERT INTO clients (name, email, company) VALUES (?, ?, ?)";
  db.query(sql, [name, email, company], (err, result) => {
    if (err) {
      console.error("Error inserting client:", err);
      res.status(500).send("Error inserting client");
      return;
    }
    res.send("Client added");
  });
});

app.post("/services", (req, res) => {
  const { description, rate } = req.body;
  const sql = "INSERT INTO services (description, rate) VALUES (?, ?)";
  db.query(sql, [description, rate], (err, result) => {
    if (err) {
      console.error("Error inserting service:", err);
      res.status(500).send("Error inserting service");
      return;
    }
    res.send("Service added");
  });
});

app.post("/invoices", upload.single("logo"), (req, res) => {
  const { clientId, items } = req.body;
  const logo = req.file;

  const sql = "INSERT INTO invoices (client_id, date) VALUES (?, NOW())";
  db.query(sql, [clientId], (err, result) => {
    if (err) {
      console.error("Error inserting invoice:", err);
      res.status(500).send("Error inserting invoice");
      return;
    }
    const invoiceId = result.insertId;

    const invoiceItems = JSON.parse(items);
    invoiceItems.forEach((item) => {
      const sqlItem =
        "INSERT INTO invoice_items (invoice_id, service_id, quantity) VALUES (?, ?, ?)";
      db.query(sqlItem, [invoiceId, item.serviceId, item.quantity], (err) => {
        if (err) {
          console.error("Error inserting invoice item:", err);
        }
      });
    });

    generateInvoice(invoiceId, logo?.path, res);
  });
});

function generateInvoice(invoiceId, logoPath, res) {
  const sql = `
    SELECT i.id, i.date, c.name as clientName, c.company as clientCompany, c.email as clientEmail,
          s.description as serviceDescription, s.rate as serviceRate, ii.quantity as itemQuantity
    FROM invoices i
    JOIN clients c ON i.client_id = c.id
    JOIN invoice_items ii ON i.id = ii.invoice_id
    JOIN services s ON ii.service_id = s.id
    WHERE i.id = ?`;

  db.query(sql, [invoiceId], (err, result) => {
    if (err) {
      console.error("Error fetching invoice data:", err);
      res.status(500).send("Error generating invoice");
      return;
    }

    if (!result.length) {
      console.error("No invoice data found for id:", invoiceId);
      res.status(404).send("Invoice not found");
      return;
    }

    const invoice = result[0];
    const doc = new PDFDocument();
    const filePath = path.join(__dirname, `invoices/invoice_${invoiceId}.pdf`);
    doc.pipe(fs.createWriteStream(filePath));

    // Add logo
    if (logoPath) {
      doc.image(logoPath, 50, 45, { width: 50 }).moveDown();
    }

    // Invoice details
    doc.fontSize(20).text("INVOICE", 110, 57).moveDown();

    doc
      .fontSize(10)
      .text(`Invoice Number: ${invoice.id}`, 200, 65, { align: "right" })
      .text(`Date: ${invoice.date}`, 200, 80, { align: "right" })
      .moveDown();

    // Client details
    doc
      .text(`Bill To:`, 50, 125)
      .text(invoice.clientName, 50, 140)
      .text(invoice.clientCompany, 50, 155)
      .text(invoice.clientEmail, 50, 170)
      .moveDown();

    // Service details
    const tableTop = 200;
    const itemDescriptionX = 50;
    const itemRateX = 300;
    const itemQuantityX = 370;
    const itemTotalX = 430;

    doc
      .text("Description", itemDescriptionX, tableTop)
      .text("Rate", itemRateX, tableTop)
      .text("Quantity", itemQuantityX, tableTop)
      .text("Total", itemTotalX, tableTop)
      .moveDown();

    let total = 0;
    result.forEach((item) => {
      const itemTotal = item.serviceRate * item.itemQuantity;
      total += itemTotal;
      const position = doc.y;

      doc
        .text(item.serviceDescription, itemDescriptionX, position)
        .text(item.serviceRate.toFixed(2), itemRateX, position)
        .text(item.itemQuantity, itemQuantityX, position)
        .text(itemTotal.toFixed(2), itemTotalX, position)
        .moveDown();
    });

    doc.text(`Total: ${total.toFixed(2)}`, itemTotalX, doc.y).moveDown();

    doc.end();
    res.download(filePath);
  });
}

app.listen(9000, () => {
  console.log("Server running on port 9000");
});
