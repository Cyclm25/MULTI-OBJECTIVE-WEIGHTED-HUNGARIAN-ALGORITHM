"""Minimal Flask app to run simulations and display results (Module 6)
"""
from flask import Flask, render_template_string, request, send_file
import io
import pandas as pd
from evaluate import batch_run

app = Flask(__name__)

TEMPLATE = """
<html>
<head><title>Hungarian Comparison</title></head>
<body>
  <h1>Hungarian Algorithm Comparison</h1>
  <form method="post">
    <label>Matrix sizes (comma-separated):</label>
    <input name="sizes" value="10,20,30,40,50,60" style="width:300px" />
    <br />
    <label>Repeats:</label>
    <input name="repeats" value="3" />
    <br />
    <button type="submit">Run</button>
  </form>
  {% if table %}
    <h2>Summary</h2>
    {{ table|safe }}
    <h2>Plot</h2>
    <img src="/outputs/comparison.png" />
  {% endif %}
</body>
</html>
"""


@app.route("/outputs/comparison.png")
def send_plot():
    return send_file("outputs/comparison.png", mimetype="image/png")


@app.route("/", methods=["GET", "POST"])
def index():
    table_html = None
    if request.method == "POST":
        sizes = request.form.get("sizes", "10,20,30,40,50,60")
        repeats = int(request.form.get("repeats", "3"))
        ns = [int(s.strip()) for s in sizes.split(",") if s.strip()]
        agg = batch_run(ns, repeats=repeats)
        table_html = agg.to_html(index=False)
    return render_template_string(TEMPLATE, table=table_html)


if __name__ == "__main__":
    app.run(debug=True)
