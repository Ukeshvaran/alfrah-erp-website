# Activate Python virtual environment
& ".\env\Scripts\Activate.ps1"

# Navigate to backend directory
Set-Location -Path ".\backend"

# Run the Flask app
python app.py
