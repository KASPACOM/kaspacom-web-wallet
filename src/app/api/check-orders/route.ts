import { HttpResponse } from '@angular/common/http';
import { OrderService } from '../../services/order.service';

const orderService = new OrderService();

export async function GET() {
    try {
        const orderData = await orderService.getOrderData();
        return new HttpResponse({ status: 200, body: orderData });
    } catch (error: any) {
        console.error('Error fetching order data:', error);
        return new HttpResponse({ status: 500, body: { error: 'Failed to fetch order data', details: error.message } });
    }
}
