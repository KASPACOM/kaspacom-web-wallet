import os
import base64
import re
import json
import asyncio
import subprocess
from collections import deque
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from telethon import TelegramClient, types
from datetime import datetime
import traceback

# Telegram API credentials
api_id = 27604145
api_hash = '7fe8a9dd73041d795086cdd42e08ada2'
BOT_USERNAME = "@kspr_1_bot"
WALLET_ADDRESS = "kaspa:qrqqg45yunuw8mk7xumlykmfdrnf7vwlp3ncdydnlufxnetcq200qytpasqhg"
MAX_PRICE_KAS = 15000  # Maximum price filter in KAS

class KaspianoTrader:
    def __init__(self):
        self.GMAIL_SCOPES = [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.modify'
        ]
        self.service = self.authenticate_gmail()
        self.telegram_client = None
        self.purchase_info = None
        self.transaction_log = []
        self.order_queue = deque()
        self.is_processing = False
        self.processed_orders = set()
        print("KaspianoxTrader initialized")

    def authenticate_gmail(self):
        """Authenticate with Gmail API"""
        print("Authenticating Gmail...")
        creds = None
        if os.path.exists('token.json'):
            print("Found existing token.json")
            creds = Credentials.from_authorized_user_file('token.json', self.GMAIL_SCOPES)
        
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                print("Refreshing expired credentials")
                creds.refresh(Request())
            else:
                print("Getting new credentials")
                flow = InstalledAppFlow.from_client_secrets_file('credentials.json', self.GMAIL_SCOPES)
                creds = flow.run_local_server(port=0)
            with open('token.json', 'w') as token:
                token.write(creds.to_json())
            print("Saved new token.json")

        print("Gmail authentication successful")
        return build('gmail', 'v1', credentials=creds)

    async def initialize_telegram(self):
        """Initialize Telegram client"""
        if not self.telegram_client:
            self.telegram_client = TelegramClient('test_session', api_id, api_hash)
            await self.telegram_client.start()
            print("Connected to Telegram")

    async def verify_transaction(self, client, bot, retries=3):
        """Verify if transaction was successful by checking messages"""
        try:
            for attempt in range(retries):
                await asyncio.sleep(5)  # Wait between checks
                messages = await client.get_messages(bot, limit=3)
                
                for msg in messages:
                    if msg and any(phrase in msg.text for phrase in [
                        "Purchase complete",
                        "Transaction confirmed",
                        "Successfully purchased"
                    ]):
                        print("Transaction verified successfully")
                        return True
                
                print(f"Verification attempt {attempt + 1}/{retries} failed, retrying...")
            
            print("Could not verify transaction after all attempts")
            return False
            
        except Exception as e:
            print(f"Error verifying transaction: {e}")
            traceback.print_exc()
            return False

    async def log_transaction(self, token_info):
        """Log successful transaction details"""
        try:
            transaction = {
                'timestamp': datetime.now().isoformat(),
                'token': token_info['token_symbol'],
                'quantity': token_info['quantity'],
                'price_kas': token_info['price_kas'],
                'unit_price': token_info.get('unit_price', 0),
                'total_price': token_info['quantity'] * token_info['price_kas']
            }
            self.transaction_log.append(transaction)
            
            # Define the sell price with a 10% markup
            sell_price = token_info['price_kas'] * 1.10

            # Create listing config
            listing_config = {
                'token': token_info['token_symbol'],
                'quantity': str(token_info['quantity']),
                'price': str(sell_price)
            }

            # Write to listing config file
            with open('listing_config.json', 'w') as f:
                json.dump(listing_config, f, indent=2)
            print("Listing config written successfully")
                
            # Write detailed transaction log
            log_entry = {
                **transaction,
                'listing_config': listing_config
            }
            
            with open('transaction_log.json', 'a') as f:
                json.dump(log_entry, f)
                f.write('\n')
                
            print(f"Transaction logged successfully:")
            print(json.dumps(log_entry, indent=2))
            return True
            
        except Exception as e:
            print(f"Error logging transaction: {e}")
            traceback.print_exc()
            return False

    async def click_button(self, message, button_text):
        """Helper function to click a button with detailed logging"""
        try:
            if not hasattr(message, 'reply_markup'):
                print(f"No reply markup found for message")
                return False
                
            print(f"\nLooking for button: {button_text}")
            print("Available buttons:")
            for row in message.reply_markup.rows:
                for button in row.buttons:
                    print(f"- '{button.text}'")
                    if button_text.lower() in button.text.strip().lower():
                        print(f"Found matching button: '{button.text}'")
                        await message.click(data=button.data)
                        return True
            print(f"Button '{button_text}' not found")
            return False
        except Exception as e:
            print(f"Error clicking button: {str(e)}")
            traceback.print_exc()
            return False

    async def parse_orders(self, message, token_name):
        """Parse all available orders from message"""
        orders = []
        try:
            if not hasattr(message, 'reply_markup'):
                return orders
                
            for row in message.reply_markup.rows:
                for button in row.buttons:
                    if '→' in button.text and 'KAS' in button.text and token_name in button.text:
                        try:
                            amount_text, price_text = button.text.split('→')
                            unit_price = float(price_text.split('|')[1].strip())
                            
                            amount_str = amount_text.strip().split()[0]
                            base_amount = float(amount_str.rstrip('KMB'))
                            multiplier = {
                                'K': 1000,
                                'M': 1000000,
                                'B': 1000000000
                            }.get(amount_str[-1], 1)
                            
                            amount = int(base_amount * multiplier)
                            kas_price = float(price_text.split('KAS')[0].strip())
                            
                            orders.append({
                                'text': button.text,
                                'amount': amount,
                                'price': kas_price,
                                'unit_price': unit_price,
                                'button_data': button.data
                            })
                            print(f"Found order: {button.text} with price per token: {unit_price}")
                        except Exception as e:
                            print(f"Error parsing individual order: {e}")
                            continue
            
            sorted_orders = sorted(orders, key=lambda x: x['unit_price'])
            print(f"\nFound {len(orders)} orders, sorted by price per token:")
            for order in sorted_orders:
                print(f"Price: {order['unit_price']} - {order['text']}")
            return sorted_orders
            
        except Exception as e:
            print(f"Error parsing orders: {e}")
            traceback.print_exc()
            return orders

    async def buy_token(self, client, bot, token_name, max_price):
        """Attempt to buy token at lowest price"""
        try:
            print(f"\nChecking marketplace for {token_name}...")
            
            await client.send_message(bot, '/marketplace')
            await asyncio.sleep(2)
            
            messages = await client.get_messages(bot, limit=1)
            if messages and "Which KRC20 token" in messages[0].text:
                await client.send_message(bot, token_name)
                await asyncio.sleep(2)

            messages = await client.get_messages(bot, limit=1)
            if not messages:
                print("No messages received from bot")
                return False

            print("Parsing available orders...")
            orders = await self.parse_orders(messages[0], token_name)
            if not orders:
                print(f"No orders found for {token_name}")
                return False

            lowest_order = orders[0]
            total_price = lowest_order['price']
            print(f"Lowest price found: {lowest_order['unit_price']} KAS per token")
            print(f"Total price: {total_price} KAS")
            
            if lowest_order['unit_price'] > max_price:
                print(f"Lowest unit price {lowest_order['unit_price']} exceeds max unit price {max_price}")
                return False
                
            if total_price > MAX_PRICE_KAS:
                print(f"Total price {total_price} KAS exceeds maximum allowed price of {MAX_PRICE_KAS} KAS")
                return False

            print(f"Attempting to click order: {lowest_order['text']}")
            await messages[0].click(data=lowest_order['button_data'])
            await asyncio.sleep(3)
            
            purchase_msg = await client.get_messages(bot, limit=1)
            if purchase_msg and hasattr(purchase_msg[0], 'reply_markup'):
                confirm_success = await self.click_button(purchase_msg[0], "Confirm")
                if confirm_success:
                    # Verify transaction and log if successful
                    if await self.verify_transaction(client, bot):
                        token_info = {
                            'token_symbol': token_name,
                            'quantity': lowest_order['amount'],
                            'price_kas': lowest_order['price'],
                            'unit_price': lowest_order['unit_price']
                        }
                        await self.log_transaction(token_info)
                        self.purchase_info = token_info
                        return True
            
            print("Purchase process did not complete successfully")
            return False

        except Exception as e:
            print(f"Error buying token: {e}")
            traceback.print_exc()
            return False

    async def transfer_token(self, client, bot, token_name):
        """Transfer token to specified wallet address"""
        try:
            await client.send_message(bot, '/transfer')
            await asyncio.sleep(3)
            
            messages = await client.get_messages(bot, limit=1)
            if messages and "Which KRC20 token" in messages[0].text:
                await client.send_message(bot, token_name)
                await asyncio.sleep(3)
            
            messages = await client.get_messages(bot, limit=1)
            if messages and "Your balance is" in messages[0].text:
                print("Got balance message, clicking Max button")
                max_success = await self.click_button(messages[0], "Max")
                if not max_success:
                    print("Failed to click Max button")
                    return False
                await asyncio.sleep(3)
            
            messages = await client.get_messages(bot, limit=1)
            if messages and "Enter the recipient's address" in messages[0].text:
                await client.send_message(bot, WALLET_ADDRESS)
                await asyncio.sleep(3)
            
            messages = await client.get_messages(bot, limit=1)
            if messages:
                confirm_success = await self.click_button(messages[0], "Confirm")
                if confirm_success:
                    print("Transfer confirmed")
                    await asyncio.sleep(3)
                    
                    messages = await client.get_messages(bot, limit=1)
                    if messages and "successfully transferred" in messages[0].text:
                        print(f"Successfully transferred {token_name}")
                        
                        # Execute the TypeScript listing script after successful transfer
                        try:
                            print("\nTrigger TypeScript listing automation...")
                            script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'listing-test.ts')
                            listing_process = subprocess.Popen(
                                ['npx', 'ts-node', script_path],
                                cwd=os.path.dirname(os.path.abspath(__file__)),
                                stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE
                            )
                            print("Listing automation script started successfully")
                            
                            # Optionally log the output
                            stdout, stderr = listing_process.communicate()
                            if stdout:
                                print("Script output:", stdout.decode())
                            if stderr:
                                print("Script errors:", stderr.decode())
                                
                        except Exception as e:
                            print(f"Error starting listing script: {e}")
                            traceback.print_exc()
                        
                        return True
            
            print("Transfer process did not complete successfully")
            return False
            
        except Exception as e:
            print(f"Error in transfer process: {e}")
            traceback.print_exc()
            return False

    async def trade_token(self, token_symbol, max_price=200):
        """Execute trade for a specific token"""
        try:
            print(f"\nProcessing {token_symbol} with max price {max_price} KAS")
            
            bot = await self.telegram_client.get_entity(BOT_USERNAME)
            print(f"Connected to KSPR Bot for {token_symbol}")
            
            purchase_success = await self.buy_token(self.telegram_client, bot, token_symbol, max_price)
            if not purchase_success:
                print(f"Failed to purchase {token_symbol}")
                return False

            print(f"Purchase successful, initiating transfer...")
            await asyncio.sleep(5)
            
            transfer_success = await self.transfer_token(self.telegram_client, bot, token_symbol)
            if not transfer_success:
                print(f"Failed to transfer {token_symbol}")
                return False

            print(f"Successfully processed and transferred {token_symbol}")
            return True
                
        except Exception as e:
            print(f"Error in trade process for {token_symbol}: {e}")
            traceback.print_exc()
            return False

    def parse_sale_email(self, message):
        """Extract token sale information from email"""
        try:
            if 'payload' not in message:
                print("No payload in message")
                return None

            headers = message['payload']['headers']
            subject = next(h['value'] for h in headers if h['name'].lower() == 'subject')
            print(f"Processing email with subject: {subject}")
            
            # Enhanced subject matching
            if not any(phrase in subject for phrase in [
                'Congratulations - Your listing',
                'Tokens Successfully Sold',
                'Purchase complete',
                'Transaction confirmed'
            ]):
                print(f"Subject '{subject}' doesn't match any expected patterns")
                return None

            # Get email body with better error handling
            try:
                if 'parts' in message['payload']:
                    body = base64.urlsafe_b64decode(message['payload']['parts'][0]['body']['data']).decode()
                else:
                    body = base64.urlsafe_b64decode(message['payload']['body']['data']).decode()
                print("Successfully decoded email body")
                print(f"Email body: {body}")  # Debug print
            except Exception as e:
                print(f"Error decoding email body: {e}")
                return None

            # Enhanced pattern matching for different email formats
            token_patterns = [
                r'(\d+(?:,\d+)*)\s+(\w+)\s+tokens?',
                r'Ticker:\s*(\w+)\s*Quantity:\s*(\d+(?:,\d+)*)',
                r'(\d+(?:,\d+)*)\s+(\w+)'  # More general pattern
            ]
            
            token_info = None
            for pattern in token_patterns:
                match = re.search(pattern, body, re.IGNORECASE)
                if match:
                    if len(match.groups()) == 2:
                        quantity = match.group(1) if pattern.startswith(r'(\d+') else match.group(2)
                        symbol = match.group(2) if pattern.startswith(r'(\d+') else match.group(1)
                        token_info = (quantity, symbol)
                        print(f"Matched token pattern: {pattern}")
                        print(f"Found quantity: {quantity}, symbol: {symbol}")
                        break

            if not token_info:
                print("Could not find token information in email")
                return None

            # Enhanced price pattern matching
            price_patterns = [
                r'(\d+\.?\d*)\s*KAS',
                r'Total Price:\s*(\d+\.?\d*)\s*KAS',
                r'Price per unit:\s*(\d+\.?\d*)\s*KAS'
            ]
            
            price = None
            for pattern in price_patterns:
                match = re.search(pattern, body, re.IGNORECASE)
                if match:
                    price = match.group(1)
                    print(f"Matched price pattern: {pattern}")
                    print(f"Found price: {price}")
                    break

            if not price:
                print("Could not find price information in email")
                return None

            # Extract order ID if present
            order_match = re.search(r'Order Id:\s*([a-zA-Z0-9]+)', body)
            if order_match:
                print(f"Found order ID: {order_match.group(1)}")
            
            # Determine transaction type
            transaction_type = 'SELL' if any(phrase in subject for phrase in ['Successfully Sold', 'Your listing']) else 'BUY'
            print(f"Determined transaction type: {transaction_type}")
            
            sale_info = {
                'token_symbol': token_info[1],
                'quantity': int(token_info[0].replace(',', '')),
                'price_kas': float(price),
                'order_id': order_match.group(1) if order_match else None,
                'subject': subject,
                'type': transaction_type
            }
            
            print(f"Successfully parsed email info: {json.dumps(sale_info, indent=2)}")
            return sale_info

        except Exception as e:
            print(f"Error parsing email: {e}")
            traceback.print_exc()
            return None

    async def monitor_sales(self):
        """Monitor inbox for new Kaspiano transaction emails"""
        try:
            print("\nChecking for new emails...")
            query = (
                'from:support@kaspiano.com '
                'subject:"Congratulations - Your listing" OR '
                'subject:"Tokens Successfully Sold" OR '
                'subject:"Purchase complete" OR '
                'subject:"Transaction confirmed"'
            )

            print(f"Using query: {query}")
            results = self.service.users().messages().list(
                userId='me',
                labelIds=['INBOX', 'UNREAD'],
                q=query
            ).execute()

            messages = results.get('messages', [])
            print(f"Found {len(messages) if messages else 0} unread messages matching query")
            
            found_sales = []
            for message in messages:
                msg = self.service.users().messages().get(
                    userId='me',
                    id=message['id']
                ).execute()
                
                sale_info = self.parse_sale_email(msg)
                if sale_info and sale_info.get('order_id') not in self.processed_orders:
                    print("Found new unprocessed transaction")
                    # Mark email as read
                    self.service.users().messages().modify(
                        userId='me',
                        id=message['id'],
                        body={'removeLabelIds': ['UNREAD']}
                    ).execute()
                    print(f"Marked email {message['id']} as read")
                    
                    print(f"Found new transaction: {json.dumps(sale_info, indent=2)}")
                    found_sales.append(sale_info)
                    
                    # Add to queue instead of processing immediately
                    self.order_queue.append(sale_info)
                    if sale_info.get('order_id'):
                        self.processed_orders.add(sale_info['order_id'])
                        print(f"Added order ID {sale_info['order_id']} to processed orders")
            
            if not found_sales:
                print("No new transactions found")
            else:
                print(f"Found {len(found_sales)} new transactions")
            
            return found_sales if found_sales else None

        except Exception as e:
            print(f"Error monitoring emails: {e}")
            traceback.print_exc()
            return None

    async def process_queue(self):
        """Process orders in the queue"""
        while True:
            try:
                if not self.is_processing and self.order_queue:
                    self.is_processing = True
                    sale_info = self.order_queue.popleft()
                    
                    print(f"\nProcessing queued order: {json.dumps(sale_info, indent=2)}")
                    print(f"Remaining orders in queue: {len(self.order_queue)}")
                    
                    await self.initialize_telegram()
                    await self.trade_token(sale_info['token_symbol'])
                    
                    self.is_processing = False
                
                await asyncio.sleep(5)  # Short sleep between queue checks
                
            except Exception as e:
                print(f"Error processing queue: {e}")
                traceback.print_exc()
                self.is_processing = False
                await asyncio.sleep(5)

async def main():
    print("Starting Kaspiano Trading Bot...")
    trader = KaspianoTrader()
    
    # Create tasks for both monitoring and processing
    monitor_task = asyncio.create_task(monitor_loop(trader))
    process_task = asyncio.create_task(trader.process_queue())
    
    try:
        # Wait for both tasks indefinitely
        await asyncio.gather(monitor_task, process_task)
    except KeyboardInterrupt:
        print("\nShutting down gracefully...")
    except Exception as e:
        print(f"Error in main loop: {e}")
        traceback.print_exc()

async def monitor_loop(trader):
    """Separate loop for monitoring emails"""
    while True:
        try:
            await trader.monitor_sales()
            await asyncio.sleep(5)  # Check emails every minute
        except Exception as e:
            print(f"Error in monitor loop: {e}")
            traceback.print_exc()
            await asyncio.sleep(5)

if __name__ == "__main__":
    print("Starting Kaspiano Trading Bot...")
    asyncio.run(main())
