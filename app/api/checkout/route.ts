import { NextRequest, NextResponse } from 'next/server';
import type { NextApiRequest, NextApiResponse } from 'next';
import NextCors from 'nextjs-cors'; // Import nextjs-cors
import PayOS from '@/lib/payos';
import { connectToDB } from '@/lib/mongoDB';
import Customer from '@/lib/models/Customer';
import Order from '@/lib/models/Order';
import mongoose from 'mongoose';
import { cookies } from 'next/headers';

interface CartItem {
  item: {
    _id: string;
    title: string;
    price: number;
    size?: string;
  };
  quantity: number;
}

// Middleware để cấu hình CORS
async function corsMiddleware(req: NextApiRequest, res: NextApiResponse) {
  await NextCors(req, res, {
    methods: ['GET', 'POST', 'OPTIONS'],
    origin: 'https://comet-store.vercel.app', // Domain của frontend
    optionsSuccessStatus: 204,
    credentials: true, // Gửi cookie kèm theo request
  });
}

// API handler cho POST request
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    await corsMiddleware(req, res); // Chạy middleware CORS

    if (req.method === 'POST') {
      const payload = req.body;

      const DOMAIN = 'https://comet-store.vercel.app';

      const customerData = cookies().get('customer');
      const cartData = cookies().get('cartItems');
      const addressData = cookies().get('shippingAddress');

      if (!customerData || !cartData || !addressData) {
        return res.status(400).json({ message: 'Missing data in cookies' });
      }

      const customer = JSON.parse(customerData.value);
      const cartItems = JSON.parse(cartData.value);
      const shippingAddress = JSON.parse(addressData.value);

      const lineItems = cartItems.map((cartItem: CartItem) => ({
        name: cartItem.item.title,
        price: cartItem.item.price,
        quantity: cartItem.quantity,
        metadata: {
          productId: cartItem.item._id,
          size: cartItem.item.size || 'N/A',
        },
      }));

      const totalAmount = lineItems.reduce(
        (acc: number, item: any) => acc + item.price * item.quantity,
        0
      );

      const body = {
        orderCode: Number(Date.now().toString().slice(-6)),
        amount: totalAmount,
        description: 'Thanh toán đơn hàng',
        items: lineItems,
        returnUrl: `${DOMAIN}/payment_success`,
        cancelUrl: `${DOMAIN}/cart`,
      };

      const paymentLinkResponse = await PayOS.createPaymentLink(body);
      const { checkoutUrl, orderCode } = paymentLinkResponse;

      await connectToDB();

      const newOrder = new Order({
        customerClerkId: customer.clerkId,
        products: cartItems.map((item: any) => ({
          product: new mongoose.Types.ObjectId(item.item._id),
          size: item.size || 'N/A',
          quantity: item.quantity,
        })),
        shippingAddress,
        totalAmount,
        orderCode,
      });

      await newOrder.save();

      let existingCustomer = await Customer.findOne({ clerkId: customer.clerkId });
      if (existingCustomer) {
        existingCustomer.orders.push(newOrder._id);
      } else {
        existingCustomer = new Customer({
          clerkId: customer.clerkId,
          name: customer.name,
          email: customer.email,
          orders: [newOrder._id],
        });
      }

      await existingCustomer.save();

      return res.status(200).json({
        paymentLink: checkoutUrl,
        orderCode,
        cartItems,
        customer,
        shippingAddress,
      });
    } else {
      return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('[checkout_POST] Error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
