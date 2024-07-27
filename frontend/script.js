document.getElementById("add-service").addEventListener("click", () => {
  const serviceDiv = document.createElement("div");
  serviceDiv.className = "service";

  serviceDiv.innerHTML = `
    <label for="serviceDescription">Description:</label>
    <input type="text" name="serviceDescription" required>
    <label for="serviceRate">Rate:</label>
    <input type="number" step="0.01" name="serviceRate" required>
    <label for="serviceQuantity">Quantity:</label>
    <input type="number" name="serviceQuantity" required>
  `;

  document.getElementById("services").appendChild(serviceDiv);
});

document
  .getElementById("invoice-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const services = [];

    document.querySelectorAll(".service").forEach((serviceDiv) => {
      const description = serviceDiv.querySelector(
        'input[name="serviceDescription"]'
      ).value;
      const rate = parseFloat(
        serviceDiv.querySelector('input[name="serviceRate"]').value
      );
      const quantity = parseInt(
        serviceDiv.querySelector('input[name="serviceQuantity"]').value
      );
      services.push({ description, rate, quantity });
    });

    formData.append("items", JSON.stringify(services));

    try {
      const response = await axios.post(
        "http://localhost:9000/invoices",
        formData,
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "multipart/form-data", // axios will set this automatically for FormData
          },
          responseType: "blob", // to handle the PDF file
        }
      );

      if (response.status === 200) {
        const url = URL.createObjectURL(response.data);
        const a = document.createElement("a");
        a.href = url;
        a.download = "invoice.pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        console.error("Failed to generate invoice");
      }
    } catch (err) {
      console.error("Error:", err);
    }
  });
