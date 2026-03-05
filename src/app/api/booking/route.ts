import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const NOTIFY_EMAIL = 'Jolee1205@gmail.com';

export async function POST(request: Request) {
  try {
    const booking = await request.json();
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: 'JOON11EE Bookings <onboarding@resend.dev>',
      to: NOTIFY_EMAIL,
      subject: `New Booking: ${booking.carBrand} ${booking.carName} — ${booking.id}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #000; color: #fff; padding: 40px;">
          <div style="border-bottom: 2px solid #DC2626; padding-bottom: 20px; margin-bottom: 30px;">
            <h1 style="margin: 0; font-size: 24px; color: #DC2626;">New Booking Received</h1>
            <p style="margin: 5px 0 0; color: #888; font-size: 14px;">ID: ${booking.id}</p>
          </div>

          <div style="margin-bottom: 30px;">
            <h2 style="font-size: 18px; margin: 0 0 15px; color: #fff;">Vehicle</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #888; font-size: 14px;">Car</td>
                <td style="padding: 8px 0; color: #fff; font-size: 14px; text-align: right;">${booking.carBrand} ${booking.carName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #888; font-size: 14px;">Location</td>
                <td style="padding: 8px 0; color: #fff; font-size: 14px; text-align: right;">${booking.cityFullName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #888; font-size: 14px;">Dates</td>
                <td style="padding: 8px 0; color: #fff; font-size: 14px; text-align: right;">${booking.startDate} — ${booking.endDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #888; font-size: 14px;">Duration</td>
                <td style="padding: 8px 0; color: #fff; font-size: 14px; text-align: right;">${booking.totalDays} day${booking.totalDays !== 1 ? 's' : ''}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #888; font-size: 14px;">Daily Rate</td>
                <td style="padding: 8px 0; color: #fff; font-size: 14px; text-align: right;">$${booking.dailyRate.toLocaleString()}</td>
              </tr>
            </table>
            <div style="margin-top: 15px; padding: 15px; border: 1px solid #333; text-align: center;">
              <p style="margin: 0; color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">Total</p>
              <p style="margin: 5px 0 0; color: #DC2626; font-size: 28px; font-weight: bold;">$${booking.totalPrice.toLocaleString()}</p>
            </div>
          </div>

          <div style="margin-bottom: 30px;">
            <h2 style="font-size: 18px; margin: 0 0 15px; color: #fff;">Customer</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #888; font-size: 14px;">Name</td>
                <td style="padding: 8px 0; color: #fff; font-size: 14px; text-align: right;">${booking.customer.firstName} ${booking.customer.lastName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #888; font-size: 14px;">Email</td>
                <td style="padding: 8px 0; color: #fff; font-size: 14px; text-align: right;">${booking.customer.email}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #888; font-size: 14px;">Phone</td>
                <td style="padding: 8px 0; color: #fff; font-size: 14px; text-align: right;">${booking.customer.phone}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #888; font-size: 14px;">Age</td>
                <td style="padding: 8px 0; color: #fff; font-size: 14px; text-align: right;">${booking.customer.age}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #888; font-size: 14px;">Driver's License</td>
                <td style="padding: 8px 0; color: #fff; font-size: 14px; text-align: right;">${booking.customer.driversLicense}</td>
              </tr>
            </table>
          </div>

          <div style="border-top: 1px solid #333; padding-top: 20px; text-align: center;">
            <p style="margin: 0; color: #555; font-size: 12px;">JOON11EE Exotic Rentals</p>
          </div>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Email send failed:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
