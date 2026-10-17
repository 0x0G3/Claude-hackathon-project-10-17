import { NextRequest, NextResponse } from 'next/server';
import { filterResources, getResourceById, getAllResources } from '@/lib/resources/loader';

export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id') || undefined;
    const category = searchParams.get('category') || undefined;
    const city = searchParams.get('city') || undefined;
    const search = searchParams.get('search') || undefined;

    if (id) {
      const resource = getResourceById(id);
      if (!resource) {
        return NextResponse.json(
          {
            success: false,
            error: `Resource with id '${id}' not found.`,
          },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        data: resource,
      });
    }

    const resources = filterResources({ category, city, search });

    return NextResponse.json({
      success: true,
      count: resources.length,
      total_seed: getAllResources().length,
      filters: {
        category: category || 'all',
        city: city || 'all',
        search: search || null,
      },
      data: resources,
    });
  } catch (error) {
    console.error('Error fetching resources:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve resources.',
      },
      { status: 500 }
    );
  }
}
