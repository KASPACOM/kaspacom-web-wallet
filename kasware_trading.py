import pandas as pd

# Path to the CSV file
csv_file = "C:\\Users\\avion\\Downloads\\kaspa-transactions-20241229-181620.csv"

# Threshold for large transactions
threshold = 15000

def find_large_transfers(csv_file, threshold):
    try:
        # Load the CSV file into a DataFrame
        df = pd.read_csv(csv_file)
        
        # Check the column names in the CSV file
        print("Columns in the CSV:", df.columns)

        # Use 'Received Amount' for filtering
        large_transfers = df[df['Received Amount'] >= threshold]

        # Display results
        if not large_transfers.empty:
            print("\nLarge Transactions (>= {} KAS):".format(threshold))
            print(large_transfers[['Date', 'Received Amount', 'TxHash']])
        else:
            print("\nNo transactions found with amount >= {} KAS.".format(threshold))
    except Exception as e:
        print(f"Error processing the CSV file: {e}")

# Run the function
find_large_transfers(csv_file, threshold)
