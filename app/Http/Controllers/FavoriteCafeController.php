<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class FavoriteCafeController extends Controller
{
    public function index()
    {
        return response()->json(auth()->user()->favoriteCafes);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'osm_id' => 'required|string',
            'name' => 'required|string',
            'latitude' => 'required|numeric',
            'longitude' => 'required|numeric',
            'address' => 'nullable|string',
        ]);

        $favorite = auth()->user()->favoriteCafes()->updateOrCreate(
            ['osm_id' => $validated['osm_id']],
            $validated
        );

        return response()->json($favorite, 201);
    }

    public function destroy($osm_id)
    {
        auth()->user()->favoriteCafes()->where('osm_id', $osm_id)->delete();
        return response()->json(['message' => 'Removed from favorites']);
    }
}
