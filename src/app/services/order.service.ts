import { Injectable } from '@angular/core';
import { MongoClient } from 'mongodb';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private uri = environment.mongodbUri;
  private walletAddress = environment.walletAddress;
  private client: MongoClient | null = null;
  private isConnected = false;

  constructor() { }

  async connectToDatabase(): Promise<MongoClient> {
    try {
      if (!this.client) {
        this.client = new MongoClient(this.uri);
      }

      if (!this.isConnected) {
        await this.client.connect();
        this.isConnected = true;
        console.log('Connected to MongoDB');
      }

      return this.client;
    } catch (error) {
      console.error('MongoDB connection error:', error);
      throw error;
    }
  }

  async getKaswareBalance(walletAddress: string): Promise<number> {
    try {
      const response = await fetch(`https://api.kaspa.org/addresses/${walletAddress}/balance`);
      const data = await response.json();
      return data.balance || 0;
    } catch (error) {
      console.error('Error fetching Kasware balance:', error);
      return 0;
    }
  }

  async getOrderData(): Promise<any> {
    try {
      const connectedClient = await this.connectToDatabase();
      const database = connectedClient.db('prod');

      // Get wallet balance from Kasware
      const kaswareBalance = await this.getKaswareBalance(this.walletAddress);

      // Get active orders
      const activeOrders = await database.collection('p2p_orders_v2')
        .find({
          status: "LISTED_FOR_SALE",
          sellerWalletAddress: this.walletAddress
        })
        .toArray();

      // Get completed orders
        const completedOrders = await database.collection('p2p_orders_v2')
            .find({
                status: "COMPLETED",
                $or: [
                    { sellerWalletAddress: this.walletAddress },
                    { buyerWalletAddress: this.walletAddress }
                ]
            })
            .sort({ updatedAt: -1 })
            .toArray();

        // Process active orders
        const processedActiveOrders = activeOrders.reduce((acc: any[], order: any) => {
            const existingToken = acc.find(item => item.token === order['ticker']);
            const totalPrice = Number(order['totalPrice']) || 0;
            const quantity = Number(order['quantity']) || 0;

            if (existingToken) {
                existingToken.total_kas += totalPrice;
                existingToken.total_quantity += quantity;
                existingToken.count += 1;
                existingToken.min = Math.min(existingToken.min, order['pricePerToken']);
                existingToken.max = Math.max(existingToken.max, order['pricePerToken']);
                existingToken.avg_price = existingToken.total_kas / existingToken.total_quantity;
                existingToken.spread = existingToken.max - existingToken.min;
            } else {
                acc.push({
                    token: order['ticker'],
                    total_kas: totalPrice,
                    total_quantity: quantity,
                    count: 1,
                    min: order['pricePerToken'],
                    max: order['pricePerToken'],
                    avg_price: order['pricePerToken'],
                    spread: 0
                });
            }
            return acc;
        }, []);

        // Get real-time token balances from wallet collection
        const walletBalances = await database.collection('wallet_balances')
            .find({
                walletAddress: this.walletAddress
            })
            .toArray();

        // Process token balances with real-time data
        const tokenBalances = walletBalances.reduce((acc: any, balance: any) => {
            acc[balance['ticker']] = Number(balance.balance) || 0;
            return acc;
        }, {});

        // Add balance data to active orders with real-time balances
        const processedActiveOrdersWithBalance = processedActiveOrders.map(order => ({
            ...order,
            wallet_balance: tokenBalances[order['token']] || 0,
            current_price: order.avg_price // You might want to fetch current price from an API
        }));

        return {
            activeOrders: processedActiveOrdersWithBalance,
            filledOrders: completedOrders.map(order => ({
                orderId: order._id,
                completedAt: order['updatedAt'],
                token: order['ticker'],
                quantity: Number(order['quantity']) || 0,
                price: Number(order['pricePerToken']) || 0,
                total: Number(order['totalPrice']) || 0,
                type: order['sellerWalletAddress'] === this.walletAddress ? 'sell' : 'buy'
            })),
            stats: {
                totalOrders: completedOrders.length,
                activeOrders: processedActiveOrdersWithBalance.length,
                totalKasDeployed: processedActiveOrdersWithBalance.reduce((sum, order) =>
                    sum + order.total_kas, 0),
                kaswareBalance: kaswareBalance
            }
        };
    } catch (error) {
        console.error('Error fetching data:', error);
        throw error;
    }
}
}
