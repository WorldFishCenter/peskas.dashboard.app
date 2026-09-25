import getDb from "./index";
import { MonthlySummaryDistrictModel } from "./schema/monthly-summary-district";

async function checkMonthlyData() {
  try {
    await getDb();
    console.log('Connected to MongoDB');

    // Get the count
    const count = await MonthlySummaryDistrictModel.countDocuments();
    console.log(`\nTotal monthly summaries: ${count}`);
    
    if (count === 0) {
      console.log('\nNo monthly summary data found. Let\'s check collection names:');
      const mongoose = require('mongoose');
      const collections = await mongoose.connection.db.listCollections().toArray();
      console.log('Collections:', collections.map((c: any) => c.name).join(', '));
    } else {
      // Get unique districts
      const districts = await MonthlySummaryDistrictModel.distinct('gaul_2_name');
      console.log(`\nDistricts: ${districts.join(', ')}`);
      
      // Get unique metrics
      const metrics = await MonthlySummaryDistrictModel.distinct('metric');
      console.log(`\nMetrics: ${metrics.join(', ')}`);
      
      // Get some sample data
      const samples = await MonthlySummaryDistrictModel.find().limit(5);
      console.log('\nSample data:');
      samples.forEach(doc => {
        console.log(`${doc.gaul_2_name} - ${doc.date} - ${doc.metric}: ${doc.value}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkMonthlyData(); 