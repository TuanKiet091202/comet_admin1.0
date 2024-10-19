import type { NextApiRequest, NextApiResponse } from 'next';
import NextCors from 'nextjs-cors';
import PayOS from '@/lib/payos';
import { connectToDB } from '@/lib/mongoDB';
import Customer from '@/lib/models/Customer';
import Order from '@/lib/models/Order';
import mongoose from 'mongoose';

interface CartItem {
  item: {
    _id: string;
    title: string;
    price: number;
    size?: string;
  };
  quantity: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Cấu hình middleware CORS
  await NextCors(req, res, {
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    origin: 'https://comet-store.vercel.app',
    optionsSuccessStatus: 204,
    credentials: true, // Đảm bảo cookie được gửi kèm trong request
  });

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    // Lấy dữ liệu từ cookies (req.cookies)
    const customerData = req.cookies.customer;
    const cartData = req.cookies.cartItems;
    const addressData = req.cookies.shippingAddress;

    if (!customerData || !cartData || !addressData) {
      return res.status(400).json({ message: 'Missing data in cookies' });
    }

    const customer = JSON.parse(customerData);
    const cartItems = JSON.parse(cartData);
    const shippingAddress = JSON.parse(addressData);

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

    const DOMAIN = 'https://comet-store.vercel.app';
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

    res.status(200).json({
      paymentLink: checkoutUrl,
      orderCode,
      cartItems,
      customer,
      shippingAddress,
    });
  } catch (error) {
    console.error('[checkout_POST] Error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
}
